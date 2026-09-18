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
    if !path.exists() {
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

    let porcelain = match run_git(&["status", "--porcelain=v1", "-b"], Some(path)) {
        Ok(out) => out,
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

    let repo_root = run_git(&["rev-parse", "--show-toplevel"], Some(path)).ok();
    let root_path = repo_root.as_deref().map(Path::new).unwrap_or(path);

    let mut branch: Option<String> = None;
    let mut files_map: HashMap<String, GitFileChange> = HashMap::new();

    for (i, line) in porcelain.lines().enumerate() {
        if i == 0 && line.starts_with("## ") {
            let branch_str = &line[3..];
            if let Some(rest) = branch_str.strip_prefix("Initial commit on ") {
                branch = Some(rest.to_string());
            } else if let Some(rest) = branch_str.strip_prefix("No commits yet on ") {
                branch = Some(rest.to_string());
            } else if branch_str.starts_with("HEAD (no branch)") {
                branch = Some("HEAD".to_string());
            } else {
                let name = branch_str.split("...").next().unwrap_or(branch_str).trim();
                branch = Some(name.to_string());
            }
            continue;
        }

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

        files_map.insert(
            file_path.clone(),
            GitFileChange {
                path: file_path,
                status: status.to_string(),
                insertions: 0,
                deletions: 0,
            },
        );
    }

    let mut total_insertions = 0usize;
    let mut total_deletions = 0usize;

    // Only run diff if there are file changes
    if !files_map.is_empty() {
        // Run single `diff HEAD --numstat` for both staged and unstaged changes
        let numstat_res = run_git(&["diff", "HEAD", "--numstat"], Some(root_path))
            .or_else(|_| run_git(&["diff", "--numstat"], Some(root_path)));

        if let Ok(numstat_out) = numstat_res {
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
        }
    }

    let mut files: Vec<GitFileChange> = files_map.into_values().collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));

    GitStatusResponse {
        is_git: true,
        repo_root,
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
    let res = match run_git(&args, Some(root_path)) {
        Ok(diff) if !diff.is_empty() => Ok(diff),
        _ => {
            let mut fallback_args = vec!["diff"];
            if let Some(f) = file {
                fallback_args.push("--");
                fallback_args.push(f);
            }
            run_git(&fallback_args, Some(root_path))
        }
    };

    if let Ok(ref diff_str) = res {
        if !diff_str.is_empty() {
            return Ok(diff_str.clone());
        }
    }

    // If file was specified and diff is empty, check if it's an untracked file
    if let Some(f) = file {
        let file_path = root_path.join(f);
        if file_path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                let lines: Vec<&str> = content.lines().collect();
                let line_count = lines.len();
                let body = lines.into_iter().map(|l| format!("+{}", l)).collect::<Vec<_>>().join("\n");
                return Ok(format!(
                    "--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n{}",
                    f, line_count, body
                ));
            }
        }
    }

    res
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

    // Sanitize branch name for directory and git ref
    let safe_branch = branch_name
        .replace(['/', '\\', ' ', ':', '~', '^', '?', '*', '[', '`'], "-")
        .trim_matches(|c| c == '-' || c == '.')
        .to_string();
    if safe_branch.is_empty() || safe_branch.starts_with('-') {
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
    let branch_exists = run_git(&["rev-parse", "--verify", &safe_branch], Some(&root_path)).is_ok();

    if branch_exists {
        // Attach existing branch to new worktree
        run_git(&["worktree", "add", "--", &worktree_dir_str, &safe_branch], Some(&root_path))?;
    } else {
        // Create new branch and worktree
        run_git(&["worktree", "add", "-b", &safe_branch, "--", &worktree_dir_str], Some(&root_path))?;
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

    #[test]
    fn test_git_diff() {
        let cur = std::env::current_dir().unwrap();
        let diff = get_git_diff(&cur, None);
        assert!(diff.is_ok());
    }
}
