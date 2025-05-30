#!/bin/bash

# current_dir=/home/jjones/projects/robinhood
current_dir=~/projects/congressgov
echo "Current directory: $current_dir"
# cd $current_dir
# git pull
# git -C $current_dir pull

source /home/tech/.nvm/nvm.sh
nvm use 14
npm i --prefix $current_dir/server
# npm run build:ui --prefix $current_dir/server
# sudo docker compose -f $current_dir/prod-docker-compose.yml up server_sbr intern  --build --force-recreate -d