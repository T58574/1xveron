use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn create_git_cmd(args: &[&str], cwd: Option<&Path>) -> Command {
    let mut cmd = Command::new("git");
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn run_git(args: &[&str], cwd: Option<&Path>) -> Result<String, String> {
    let mut cmd = create_git_cmd(args, cwd);
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if err.is_empty() {
            format!("git exited with status {}", output.status)
        } else {
            err
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileChange {
    pub path: String,
    pub status: String, // "modified", "added", "deleted", "untracked"
    pub insertions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusResponse {
    pub is_git: bool,
    pub repo_root: Option<String>,
    pub branch: Option<String>,
    pub insertions: usize,
    pub deletions: usize,
    pub files_count: usize,
    pub files: Vec<GitFileChange>,
}

pub fn get_git_status(path: &Path) -> GitStatusResponse {
    let repo_root = match run_git(&["rev-parse", "--show-toplevel"], Some(path)) {
        Ok(root) => root,
        Err(_) => {
            return GitStatusResponse {
                is_git: false,
                repo_root: None,
                branch: None,
                insertions: 0,
                deletions: 0,
                files_count: 0,
                files: vec![],
            };
        }
    };

    let root_path = Path::new(&repo_root);

    // Current branch
    let branch = run_git(&["branch", "--show-current"], Some(root_path))
        .ok()
        .and_then(|b| {
            if b.is_empty() {
                // Detached HEAD fallback
                run_git(&["rev-parse", "--short", "HEAD"], Some(root_path)).ok()
            } else {
                Some(b)
            }
        });

    let mut files_map: HashMap<String, GitFileChange> = HashMap::new();
    let mut total_insertions = 0usize;
    let mut total_deletions = 0usize;

    // Helper to parse numstat output
    let mut parse_numstat = |numstat_out: &str| {
        for line in numstat_out.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 3 {
                let ins = parts[0].parse::<usize>().unwrap_or(0);
                let del = parts[1].parse::<usize>().unwrap_or(0);
                let file_path = parts[2].trim().to_string();

                total_insertions += ins;
                total_deletions += del;

                files_map
                    .entry(file_path.clone())
                    .and_modify(|entry| {
                        entry.insertions += ins;
                        entry.deletions += del;
                    })
                    .or_insert(GitFileChange {
                        path: file_path,
                        status: "modified".to_string(),
                        insertions: ins,
                        deletions: del,
                    });
            }
        }
    };

    // Unstaged changes
    if let Ok(unstaged_stat) = run_git(&["diff", "--numstat"], Some(root_path)) {
        parse_numstat(&unstaged_stat);
    }

    // Staged changes
    if let Ok(staged_stat) = run_git(&["diff", "--cached", "--numstat"], Some(root_path)) {
        parse_numstat(&staged_stat);
    }

    // Check porcelain status for untracked or specific file statuses
    if let Ok(porcelain) = run_git(&["status", "--porcelain"], Some(root_path)) {
        for line in porcelain.lines() {
            if line.len() < 3 {
                continue;
            }
            let index_status = &line[0..1];
            let worktree_status = &line[1..2];
            let file_path = line[3..].trim().to_string();

            let status = if index_status == "?" || worktree_status == "?" {
                "untracked"
            } else if index_status == "A" || worktree_status == "A" {
                "added"
            } else if index_status == "D" || worktree_status == "D" {
                "deleted"
            } else {
                "modified"
            };

            files_map
                .entry(file_path.clone())
                .and_modify(|entry| {
                    entry.status = status.to_string();
                })
                .or_insert(GitFileChange {
                    path: file_path,
                    status: status.to_string(),
                    insertions: 0,
                    deletions: 0,
                });
        }
    }

    let mut files: Vec<GitFileChange> = files_map.into_values().collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));

    GitStatusResponse {
        is_git: true,
        repo_root: Some(repo_root),
        branch,
        insertions: total_insertions,
        deletions: total_deletions,
        files_count: files.len(),
        files,
    }
}

pub fn get_git_diff(path: &Path, file: Option<&str>) -> Result<String, String> {
    let repo_root = run_git(&["rev-parse", "--show-toplevel"], Some(path))?;
    let root_path = Path::new(&repo_root);

    let mut args = vec!["diff", "HEAD"];
    if let Some(f) = file {
        args.push("--");
        args.push(f);
    }

    // Try diff HEAD first; if repo has no commits yet, fallback to plain `git diff`
    match run_git(&args, Some(root_path)) {
        Ok(diff) if !diff.is_empty() => Ok(diff),
        _ => {
            let mut fallback_args = vec!["diff"];
            if let Some(f) = file {
                fallback_args.push("--");
                fallback_args.push(f);
            }
            run_git(&fallback_args, Some(root_path))
        }
    }
}

pub fn get_git_branches(path: &Path) -> Result<Vec<String>, String> {
    let repo_root = run_git(&["rev-parse", "--show-toplevel"], Some(path))?;
    let root_path = Path::new(&repo_root);

    let output = run_git(&["branch", "--format=%(refname:short)"], Some(root_path))?;
    let branches = output
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    Ok(branches)
}

pub fn create_git_worktree(repo_path: &Path, branch_name: &str) -> Result<PathBuf, String> {
    let repo_root = run_git(&["rev-parse", "--show-toplevel"], Some(repo_path))?;
    let root_path = PathBuf::from(repo_root);

    // Sanitize branch name for directory
    let safe_branch = branch_name
        .replace(['/', '\\', ' ', ':', '~', '^', '?', '*', '[', '`'], "-")
        .trim_matches(|c| c == '-' || c == '.')
        .to_string();
    if safe_branch.is_empty() {
        return Err("Invalid branch name".to_string());
    }

    let worktree_dir = root_path.join(".veron").join("worktrees").join(&safe_branch);

    // Ensure parent directory exists
    if let Some(parent) = worktree_dir.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // Ensure .gitignore in repo_root ignores .veron/worktrees/
    let gitignore_path = root_path.join(".gitignore");
    if gitignore_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&gitignore_path) {
            if !content.contains(".veron/worktrees") {
                let _ = std::fs::OpenOptions::new()
                    .append(true)
                    .open(&gitignore_path)
                    .map(|mut f| {
                        use std::io::Write;
                        let _ = writeln!(f, "\n# Veron Worktrees\n.veron/worktrees/");
                    });
            }
        }
    }

    let worktree_dir_str = worktree_dir.to_string_lossy().to_string();

    // Check if branch already exists
    let branch_exists = run_git(&["rev-parse", "--verify", branch_name], Some(&root_path)).is_ok();

    if branch_exists {
        // Attach existing branch to new worktree
        run_git(&["worktree", "add", &worktree_dir_str, branch_name], Some(&root_path))?;
    } else {
        // Create new branch and worktree
        run_git(&["worktree", "add", "-b", branch_name, &worktree_dir_str], Some(&root_path))?;
    }

    Ok(worktree_dir)
}

pub fn remove_git_worktree(repo_path: &Path, worktree_path: &Path) -> Result<(), String> {
    let root_res = run_git(&["rev-parse", "--show-toplevel"], Some(repo_path));
    let worktree_str = worktree_path.to_string_lossy().to_string();

    if let Ok(repo_root) = root_res {
        let root_path = Path::new(&repo_root);
        let _ = run_git(&["worktree", "remove", "--force", &worktree_str], Some(root_path));
        let _ = run_git(&["worktree", "prune"], Some(root_path));
    }

    // Safely verify worktree_path is inside .veron/worktrees before deleting
    let worktrees_root = repo_path.join(".veron").join("worktrees");
    let is_safe_worktree_path = if let (Ok(canon_target), Ok(canon_root)) =
        (worktree_path.canonicalize(), worktrees_root.canonicalize())
    {
        canon_target.starts_with(&canon_root) && canon_target != canon_root
    } else {
        worktree_str.contains(".veron") && worktree_str.contains("worktrees")
    };

    if is_safe_worktree_path && worktree_path.exists() {
        let _ = std::fs::remove_dir_all(worktree_path);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_status() {
        let cur = std::env::current_dir().unwrap();
        let status = get_git_status(&cur);
        assert!(status.is_git);
        assert!(status.branch.is_some());
    }

    #[test]
    fn test_git_branches() {
        let cur = std::env::current_dir().unwrap();
        let branches = get_git_branches(&cur).unwrap();
        assert!(branches.contains(&"main".to_string()));
    }
}
