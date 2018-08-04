export IDE_PATH=~/web-cpp/ide
export IO_PATH=~/zurl.github.io
cd $IDE_PATH
export VERSION=`cat js/version.js | awk '{print $5;}'`
parcel build index.html --public-url '/web-cpp'
rm dist/*.map
cd $IO_PATH/web-cpp
rm *.js
rm *.css
rm *.html
cp $IDE_PATH/* .
git add .
git commit -m $VERSION
git push origin master
cd $IDE_PATH
git add .
git commit -m $VERSION
git push origin master