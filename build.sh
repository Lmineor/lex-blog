#/bin/bash

git pull
npm run build
cp -rf build/* /www/wwwroot/blog.mineor.xyz/
