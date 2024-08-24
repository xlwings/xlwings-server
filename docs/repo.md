# Set up your repository

You will need basic familiarity with Git and have Git installed locally.

1. Create a new Git repository with your favorite provider, e.g., GitHub. You can call anything you want, but for the purpose of this tutorial, we're assuming that you've called it `myaddin`.
2. Open a terminal/command prompt and clone the repo locally: `git clone <URL>`. You will get a warning that you've clone an empty repo---that's ok!
3. Change into the Git repo: `cd myaddin`.
4. Add `xlwings-server` as the upstream origin:

   ```shell
   git remote add upstream git@github.com:xlwings/xlwings-server.git
   ```
5. Run `git fetch upstream`
6. Run `git merge 0.5.1`
git rm --cached .github/workflows/xlwings-*.yml
5. Add the following line to `.gitignore`: `.github/workflows/xlwings-*.yml`
git add .gitignore
git commit -m "updated gitignore"
7. `git push origin main`


SETUP
1. git clone git@github.com:xlwings/xlwings-server.git myaddin
2. cd myaddin
3. git remote rename origin upstream
4. git remote add origin <URL>
6. git config --local merge.ours.driver true
5. git push origin main

UPGRADE
git fetch upstream
git merge --no-edit 0.5.3
