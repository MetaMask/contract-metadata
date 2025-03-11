const fs = require("fs");
const contractMap = require("./contract-map.json");

const iconsFolder = "./icons";
const metadataFolder = "./metadata";
const main = async () => {
  await Promise.all(
    Object.entries(contractMap).map(async ([contractAddress, metadata]) => {
      //if is not erc20, skip
      if (!metadata.erc20) {
        return;
      }
      const caip19ID = `eip155:1/erc20:${contractAddress}`;
      const iconPath = `${iconsFolder}/${caip19ID}.svg`;
      const metadataPath = `${metadataFolder}/${caip19ID}.json`;
      const oldImagesPath = `./images/${metadata.logo}`;
      if (!fs.existsSync(oldImagesPath)) {
        console.log(`Image not found: ${oldImagesPath}`);

        return;
      }
      console.log(`Folder not found: ${iconsFolder}`);

      if (!fs.existsSync(iconPath)) {
        console.log(`Folder not found: ${iconsFolder}`);
        const folder = await fs.promises.mkdir(
          iconPath.split("/").slice(0, -1).join("/"),
          { recursive: true },
        );
        if (folder) {
          console.log(`Folder created: ${folder}`);
        }
      }

      await fs.promises.copyFile(oldImagesPath, iconPath);
      if (!fs.existsSync(metadataPath)) {
        const newMetadataFolder = await fs.promises.mkdir(
          metadataPath.split("/").slice(0, -1).join("/"),
          {
            recursive: true,
          },
        );
        if (newMetadataFolder) {
          console.log(`Folder created: ${newMetadataFolder}`);
        }
      }

      await fs.promises.writeFile(
        metadataPath,
        JSON.stringify(
          {
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            erc20: metadata.erc20,
            logo: `${iconPath}`,
          },
          null,
          2,
        ),
      );
    }),
  );
};

main().then((d) => {
  console.log("done");
});
