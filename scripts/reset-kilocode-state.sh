#!/bin/sh

echo "Kilocode state is being reset.  This probably doesn't work while VS Code is running."

# Reset the secrets:
sqlite3 ~/Library/Application\ Support/Code/User/globalStorage/state.vscdb \
"DELETE FROM ItemTable WHERE \
    key = '8th-wall.8th-wall-agent' OR \
    key LIKE 'workbench.view.extension.8th-wall-agent%' OR \
    key LIKE 'secret://{\"extensionId\":\"8th-wall.8th-wall-agent\",%';"

# delete all kilocode state files:
rm -rf ~/Library/Application\ Support/Code/User/globalStorage/8th-wall.8th-wall-agent/

# clear some of the vscode cache that I've observed contains kilocode related entries:
rm -f ~/Library/Application\ Support/Code/CachedProfilesData/__default__profile__/extensions.user.cache
