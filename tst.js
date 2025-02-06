const main = () => {
  console.time("tst");
  const contractMap = require("./index.js");
  console.log(contractMap);

  console.timeEnd("tst");
};

main();
