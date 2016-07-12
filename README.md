## What's the difference?

A fork of Gaze repo solving performance issues on Windows machines. Due to non-responding original  owner I cannot merge my fix into the original repo. Please use this fork if you experience problems on Windows.

## How to use

Gaze module is frequently used by another dependency. This means that more likely your project won't use it directly, but gaze can be used by one of its dependencies. To replace faulty gaze version with this one:

 1. Download the repo into a folder of your choice.
 2. Open the project folder, then 'npm install' and then 'grunt'.
 3. Execute 'npm link' command to create a globally-installed symbolic link to the current folder.
 4. Next go to your project's folder and execute 'npm link gaze' there. This will replace faulty gaze version with this project's one.
 5. Start the project as usual and enjoy it.
