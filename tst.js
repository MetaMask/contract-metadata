const main = () => {
  console.time("tst");
  const contractMap = require("./buildindex.js");
  console.log(contractMap);

  console.timeEnd("tst");
};

main();
