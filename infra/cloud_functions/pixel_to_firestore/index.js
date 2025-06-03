
const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();
const {Firestore} = require('@google-cloud/firestore');
const firestore = new Firestore();
const functions = require('@google-cloud/functions-framework');


functions.http('transferData', (req, res) => {
  let bigqueryTableID;
  let firestoreCollection;
  let columnName;
  let tableLocation;

  if(req.body.bigqueryTableID && req.body.firestoreCollection && req.body.columnName && req.body.tableLocation){
    bigqueryTableID = req.body.bigqueryTableID;
    firestoreCollection = req.body.firestoreCollection;
    columnName = req.body.columnName;
    tableLocation = req.body.location;
    transferData();
    
  }
  else{
    res.status(500).json({"success":"false","message":"Wrong / Missing Request Body"});
  }

  async function transferData() {
   
    let bulkWriter = firestore.bulkWriter();
    let documentID;
    console.log(req.body);
    console.log(toString(req));
    const query = `SELECT * FROM \`${bigqueryTableID}\``;

    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    const bigQueryOptions = {
      query: query,
      // Location must match that of the dataset(s) referenced in the query.
      location: tableLocation,
    };

    // Run the query as a job
    const [job] = await bigquery.createQueryJob(bigQueryOptions);
    console.log(`BigQuery Job ${job.id} started.`);

    // Wait for the query to finish
    const [rows] = await job.getQueryResults();
    console.log(`BigQIery Job ${job.id} finished.`)
    const firestoreOptions = {"merge":true};
    
    //Bulkwrite rows to Firestore Collection
    rows.forEach(function(row){
      documentID = firestoreCollection+"/"+row[columnName];
      bulkWriter.set(firestore.doc(documentID), row, firestoreOptions).catch((err) => {
        console.log(`Failed to create / update document: ${err}`);
      });
    });

    await bulkWriter.close().then(function(){
      console.log("Executed all writes");
    });
    return res.status(200).json({"success":"true","message":"complete"});
  }
});