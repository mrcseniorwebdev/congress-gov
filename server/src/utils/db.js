// import mariadb
const mariadb = require("mariadb");

// create a new connection pool
console.log({ "process.env.DEV": process.env.DEV });

// Get the command-line arguments excluding the first two (node and script path)
const args = process.argv.slice(2);

// Check if the '--dev' flag exists in the arguments
const DEV_MODE = args.includes("--dev");

const mariaConfig = DEV_MODE
  ? {
      host: "localhost",
      port: 33306,
      user: "user",
      password: "pass",
      database: "searchbiasreport",
    }
  : {
      host: "db",
      user: process.env.MARIA_DB_USER,
      password: process.env.MARIA_DB_PASS,
      database: "searchbiasreport",
    };

console.log({ mariaConfig });

const pool = mariadb.createPool(mariaConfig);
// const pool = mariadb.createPool({
//   host: "db",
//   user: process.env.MARIA_DB_USER,
//   password: process.env.MARIA_DB_PASS,
//   database: "searchbiasreport",
// });
// const pool = mariadb.createPool({
//   host: "localhost",
//   port: 33306,
//   user: "user",
//   password: "pass",
//   database: "searchbiasreport",
// });

const getConnection = () => {
  return new Promise(function (resolve, reject) {
    pool
      .getConnection()
      .then(function (connection) {
        resolve(connection);
      })
      .catch(function (error) {
        reject(error);
      });
  });
};
// expose the ability to create new connections
module.exports = {
  getConnection,
};

// const pool =
//   process.env.DEV === "true"
//     ? mariadb.createPool({
//         host: "localhost",
//         port: 33306,
//         user: "user",
//         password: "pass",
//         database: "searchbiasreport",
//       })
//     : mariadb.createPool({
//         host: "db",
//         user: process.env.MARIA_DB_USER,
//         password: process.env.MARIA_DB_PASS,
//         database: "searchbiasreport",
//       });

// create a new connection pool
// const pool = mariadb.createPool({
//     host: 'db',
//     user: process.env.MARIA_DB_USER,
//     password: process.env.MARIA_DB_PASS,
//     database: 'searchbiasreport'
// })
