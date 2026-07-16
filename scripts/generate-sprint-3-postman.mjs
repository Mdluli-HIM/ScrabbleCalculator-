import fs from "node:fs";
import console from "node:console";
import crypto from "node:crypto";

const src="postman/ScrabbleCalculator-Sprint-2.postman_collection.json";
const out="postman/ScrabbleCalculator-Sprint-3.postman_collection.json";
const envPath="postman/ScrabbleCalculator-Local.postman_environment.json";

let c=JSON.parse(fs.readFileSync(src,"utf8"));
const env=JSON.parse(fs.readFileSync(envPath,"utf8"));

c.info._postman_id=crypto.randomUUID();
c.info.name="ScrabbleCalculator API - Sprint 3";
c.info.description="Sprint 2 workflow extended with versioned local dictionary validation for registered and guest matches. No external dictionary API is called.";

const folder=(name)=>{
  const value=c.item.find((item)=>item.name===name);
  if(!value) throw new Error(`Missing folder: ${name}`);
  return value;
};

const item=(group,name)=>{
  const value=group.item.find((entry)=>entry.name===name);
  if(!value) throw new Error(`Missing request: ${name}`);
  return value;
};

const setPolicy=(request,policy)=>{
  const body=JSON.parse(request.request.body.raw);
  body.dictionaryPolicy=policy;
  request.request.body.raw=JSON.stringify(body,null,2);
};

const testEvent=(lines)=>({
  listen:"test",
  script:{type:"text/javascript",exec:lines}
});

const addTest=(request,lines)=>{
  request.event??=[];
  let event=request.event.find((entry)=>entry.listen==="test");
  if(!event){
    event=testEvent([]);
    request.event.push(event);
  }
  event.script.exec.push("",...lines);
};

const headers=(auth)=>[
  {key:"Accept",value:"application/json"},
  {key:"Content-Type",value:"application/json"},
  auth==="registered"
    ? {key:"Authorization",value:"Bearer {{accessToken}}"}
    : {key:"x-guest-session-token",value:"{{guestSessionToken}}"}
];

const make=(name,method,path,auth,body,tests)=>({
  name,
  request:{
    method,
    header:headers(auth),
    body:{mode:"raw",raw:JSON.stringify(body,null,2),options:{raw:{language:"json"}}},
    url:`{{baseUrl}}/api/{{apiVersion}}${path}`
  },
  event:[testEvent(tests)]
});

const insertAfter=(group,name,requests)=>{
  const index=group.item.findIndex((entry)=>entry.name===name);
  if(index<0) throw new Error(`Cannot insert after: ${name}`);
  group.item.splice(index+1,0,...requests);
};

const remove=(group,names)=>{
  group.item=group.item.filter((entry)=>!names.includes(entry.name));
};

const registered=folder("03 - Registered Match Setup");
const guest=folder("04 - Guest Match and Ownership Transfer");
const identity=folder("02 - Registered Identity");

item(
  identity,
  "Register Sprint 2 User"
).name="Register Sprint 3 User";

const finalMatchList=item(
  guest,
  "List All Registered Matches After Claim"
);

for(const event of finalMatchList.event??[]){
  if(event.listen!=="test") continue;

  event.script.exec=(event.script.exec??[]).map(
    (line)=>line
      .replace(
        "Both matches belong to the user",
        "All three matches belong to the user"
      )
      .replace(
        "to.eql(2)",
        "to.eql(3)"
      )
  );
}

setPolicy(item(registered,"Create Registered Match"),"LOCAL_WORD_LIST");
setPolicy(item(guest,"Create Guest Match"),"LOCAL_WORD_LIST");

addTest(item(registered,"Start Registered Match"),[
  "pm.test('Registered match locks the local lexicon', function () {",
  "  const body = pm.response.json();",
  "  pm.expect(body.data.match.dictionaryLexicon.code).to.eql('LOCAL_STARTER');",
  "  pm.expect(body.data.match.dictionaryLexicon.version).to.eql('1.0.0');",
  "});"
]);

addTest(item(guest,"Start Guest Match"),[
  "pm.test('Guest match locks the local lexicon', function () {",
  "  const body = pm.response.json();",
  "  pm.expect(body.data.match.dictionaryLexicon.code).to.eql('LOCAL_STARTER');",
  "  pm.expect(body.data.match.dictionaryLexicon.version).to.eql('1.0.0');",
  "});"
]);

remove(registered,[
  "Validate Accepted Words",
  "Validate Mixed Words and Suggestions",
  "Reject Unsupported Dictionary Characters"
]);

insertAfter(registered,"Start Registered Match",[
  make(
    "Validate Accepted Words","POST",
    "/matches/{{registeredMatchId}}/dictionary/validate",
    "registered",
    {words:["quiz","WORLD","scrabble"]},
    [
      "pm.test('Status is 200', function () { pm.response.to.have.status(200); });",
      "const body = pm.response.json();",
      "pm.test('All words are accepted by the locked lexicon', function () {",
      "  pm.expect(body.data.validation.accepted).to.eql(true);",
      "  pm.expect(body.data.validation.lexicon.code).to.eql('LOCAL_STARTER');",
      "  pm.expect(body.data.validation.lexicon.version).to.eql('1.0.0');",
      "});"
    ]
  ),
  make(
    "Validate Mixed Words and Suggestions","POST",
    "/matches/{{registeredMatchId}}/dictionary/validate",
    "registered",
    {words:["QUIZ","QUZI"]},
    [
      "pm.test('Status is 200', function () { pm.response.to.have.status(200); });",
      "const body = pm.response.json();",
      "const rejected = body.data.validation.words.find(function (word) { return word.normalizedWord === 'QUZI'; });",
      "pm.test('Invalid word stays rejected and receives QUIZ as a suggestion', function () {",
      "  pm.expect(body.data.validation.accepted).to.eql(false);",
      "  pm.expect(rejected.accepted).to.eql(false);",
      "  pm.expect(rejected.suggestions).to.include('QUIZ');",
      "});"
    ]
  ),
  make(
    "Reject Unsupported Dictionary Characters","POST",
    "/matches/{{registeredMatchId}}/dictionary/validate",
    "registered",
    {words:["HELLO!"]},
    [
      "pm.test('Status is 400', function () { pm.response.to.have.status(400); });"
    ]
  )
]);

addTest(item(registered,"Get Registered Match"),[
  "pm.test('Match response exposes locked dictionary metadata', function () {",
  "  const body = pm.response.json();",
  "  pm.expect(body.data.match.dictionaryLexicon.code).to.eql('LOCAL_STARTER');",
  "  pm.expect(body.data.match.dictionaryLexicon.version).to.eql('1.0.0');",
  "});"
]);

remove(guest,["Validate Guest Match Words"]);

insertAfter(guest,"Start Guest Match",[
  make(
    "Validate Guest Match Words","POST",
    "/matches/{{guestMatchId}}/dictionary/validate",
    "guest",
    {words:["HELLO","QUZI"]},
    [
      "pm.test('Status is 200', function () { pm.response.to.have.status(200); });",
      "const body = pm.response.json();",
      "pm.test('Guest validation accepts valid words and rejects invalid words', function () {",
      "  pm.expect(body.data.validation.accepted).to.eql(false);",
      "  pm.expect(body.data.validation.words[0].accepted).to.eql(true);",
      "  pm.expect(body.data.validation.words[1].accepted).to.eql(false);",
      "  pm.expect(body.data.validation.words[1].suggestions).to.include('QUIZ');",
      "});"
    ]
  )
]);

c.item=c.item.filter((entry)=>entry.name!=="04 - External Dictionary Provider Disabled");
guest.name="05 - Guest Match and Ownership Transfer";

const external={
  name:"04 - External Dictionary Provider Disabled",
  item:[
    make(
      "Create Oxford Policy Match","POST","/matches","registered",
      {name:"External Dictionary Policy Match",dictionaryPolicy:"OXFORD_ONLY"},
      [
        "pm.test('Status is 201', function () { pm.response.to.have.status(201); });",
        "const body = pm.response.json();",
        "pm.environment.set('externalMatchId', body.data.match.id);"
      ]
    ),
    make(
      "Add Registered Player to Oxford Match","POST",
      "/matches/{{externalMatchId}}/players","registered",
      {source:"REGISTERED_USER"},
      ["pm.test('Status is 201', function () { pm.response.to.have.status(201); });"]
    ),
    make(
      "Add Local Player to Oxford Match","POST",
      "/matches/{{externalMatchId}}/players","registered",
      {source:"LOCAL",displayName:"External Policy Opponent"},
      ["pm.test('Status is 201', function () { pm.response.to.have.status(201); });"]
    ),
    make(
      "Start Oxford Policy Match","POST",
      "/matches/{{externalMatchId}}/start","registered",{},
      ["pm.test('Status is 200', function () { pm.response.to.have.status(200); });"]
    ),
    make(
      "Reject Unconfigured Oxford Validation","POST",
      "/matches/{{externalMatchId}}/dictionary/validate","registered",
      {words:["QUIZ"]},
      [
        "pm.test('Status is 409', function () { pm.response.to.have.status(409); });",
        "const body = pm.response.json();",
        "pm.test('External provider is unavailable', function () {",
        "  pm.expect(body.error.code).to.eql('DICTIONARY_POLICY_NOT_AVAILABLE');",
        "});"
      ]
    )
  ]
};

const guestIndex=c.item.findIndex((entry)=>entry===guest);
c.item.splice(guestIndex,0,external);

let serialized=JSON.stringify(c,null,2);
serialized=serialized.replace(/0\.\d+\.\d+/g,"0.4.0");
fs.writeFileSync(out,serialized+"\n");

env.values??=[];
if(!env.values.some((entry)=>entry.key==="externalMatchId")){
  env.values.push({key:"externalMatchId",value:"",type:"default",enabled:true});
}
fs.writeFileSync(envPath,JSON.stringify(env,null,2)+"\n");

const count=(items)=>items.reduce((total,entry)=>total+(entry.request?1:0)+(entry.item?count(entry.item):0),0);
console.log(`Created ${out}`);
console.log(`Updated ${envPath}`);
console.log(`Request count: ${count(c.item)}`);
