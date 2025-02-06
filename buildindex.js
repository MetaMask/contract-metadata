const fs = require("fs");
const path = require("path");

const fetchAndBuild = (() => {
  const metadataFolder = "./metadata";
  // step through every file in the metadata folder, recursively, and build the contractMap
  const contractMap = {};
  const recursiveFileNames = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        recursiveFileNames(filePath);
      } else {
        const fileData = fs.readFileSync(filePath);
        const metadata = JSON.parse(fileData);
        // console.log(filePath.split("/").slice(1).join("/").split(".")[0]);
        contractMap[filePath.split("/").slice(1).join("/").split(".")[0]] =
          metadata;
      }
    });
  };
  recursiveFileNames(metadataFolder);
  return contractMap;
})();
module.exports = fetchAndBuild;
