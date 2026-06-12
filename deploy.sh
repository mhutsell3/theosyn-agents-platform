#!/bin/bash
# Deploy theosyn-agents to the server
PM2=/home/mhutsell3/.nvm/versions/node/v20.20.2/bin/pm2
ssh -i "/c/Users/Milford Hutsell/.ssh/id_ed25519" mhutsell3@192.168.5.3 \
  "cd /opt/theosyn-agents && git pull origin master && npm install && npm run build && $PM2 restart theosyn-agents"
