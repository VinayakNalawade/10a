const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());
let db;

//initialize server
let initialize = async () => {
  let dbPath = path.join(__dirname, "covid19IndiaPortal.db");

  db = await open({ filename: dbPath, driver: sqlite3.Database });

  app.listen(3000, () => console.log("Server is Online"));
};

initialize();

//authentication
function authenticator(request, response, next) {
  let jwtToken;
  let authorization = request.headers["authorization"];

  if (authorization !== undefined) {
    jwtToken = authorization.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

//API 1
app.post("/login/", async (request, response) => {
  let { username, password } = request.body;

  let user = await db.get(`SELECT * FROM user WHERE username = '${username}';`);

  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    if (await bcrypt.compare(password, user.password)) {
      let payload = { username: username };
      let jwtToken = jwt.sign(payload, "secret");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticator, async (request, response) => {
  let query = `SELECT * FROM state`;

  let result = await db.all(query);

  function convertor(obj) {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    };
  }

  response.send(result.map((obj) => convertor(obj)));
});

//API 3
app.get("/states/:stateId", authenticator, async (request, response) => {
  let { stateId } = request.params;
  let query = `SELECT * FROM state WHERE state_id = ${stateId}`;

  let result = await db.get(query);

  function convertor(obj) {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    };
  }

  response.send(convertor(result));
});

//API 4
app.post("/districts/", authenticator, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;

  let query = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) 
    VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active},${deaths} )`;

  await db.run(query);

  response.send("District Successfully Added");
});

//API 5
app.get("/districts/:districtId", authenticator, async (request, response) => {
  let { districtId } = request.params;
  let query = `SELECT * FROM district WHERE district_id = ${districtId}`;

  let result = await db.get(query);

  function convertor(obj) {
    return {
      districtId: obj.district_id,
      districtName: obj.district_name,
      stateId: obj.state_id,
      cases: obj.cases,
      cured: obj.cured,
      active: obj.active,
      deaths: obj.deaths,
    };
  }

  response.send(convertor(result));
});

//API 6
app.delete(
  "/districts/:districtId",
  authenticator,
  async (request, response) => {
    let { districtId } = request.params;

    let query = `DELETE FROM district WHERE district_id = ${districtId}`;

    await db.run(query);

    response.send("District Removed");
  }
);

//API 7
app.put("/districts/:districtId", authenticator, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;

  let query = `UPDATE district SET district_name = '${districtName}' ,
  state_id = ${stateId} ,
  cases = ${cases} ,
  cured = ${cured} ,
  active = ${active} ,
  deaths = ${deaths}`;

  await db.run(query);

  response.send("District Details Updated");
});

//API 8
app.get("/states/:stateId/stats", authenticator, async (request, response) => {
  let { stateId } = request.params;
  let query = `SELECT SUM(cases) AS totalCases,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) AS totalDeaths
  FROM district WHERE state_id = ${stateId} `;

  let result = await db.get(query);

  response.send(result);
});

//module exports
module.exports = app;
