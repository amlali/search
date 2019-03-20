const cities = require('./cities.json');
const elasticsearch = require('elasticsearch');
const express = require( 'express' );
const app     = express();
const bodyParser = require('body-parser')
const path    = require( 'path' );
const {User}=require('./models/user.js')

const client = new elasticsearch.Client({
    hosts: [ 'http://localhost:9200']
 });
 // ping the client to be sure Elasticsearch is up
 client.ping({
      requestTimeout: 30000,
  }, function(error) {
  // at this point, eastic search is down, please check your Elasticsearch service
      if (error) {
          console.error('Elasticsearch cluster is down!');
      } else {
          console.log('Everything is ok');
      }
  });
  client.index({
    index: 'scotch.io-tutorial',
    id: '1',
    type: 'cities_list',
    body: {
 
    }
}, function(err, resp, status) {
    console.log('---------------------->resp',resp);
    
    
});
  client.indices.create({
    index: 'scotch2.io-tutorial'
}, function(error, response, status) {
    if (error) {
        console.log("#########################################",error);
    } else {
        console.log("created a new index", response);
    }
});


var bulk = [];
cities.forEach(city =>{
   bulk.push({index:{ 
                 _index:"scotch2.io-tutorial", 
                 _type:"cities_list",
             }          
         })
         console.log('array');
         
  bulk.push(city)
})
//perform bulk indexing of the data passed
client.bulk({body:bulk}, function( err, response  ){ 
    console.log('create bulk');
    
         if( err ){ 
             console.log("Failed Bulk operation", err) 
         } else { 
             console.log("Successfully imported %s", cities.length); 
         } 
}); 

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
app.use(bodyParser.json())
app.set( 'port', process.env.PORT || 3000 );

app.get('/search', function (req, res){
    // declare the query object to search elastic search and return only 200 results from the first result found. 
    // also match any data where the name is like the query string sent in
    console.log('search');
    
    let body = {
      size: 200,
      from: 0, 
      query: {
        regexp: {
            name: req.query['q'],
            
        }
      }
    }
    // perform the actual search passing in the index, the search query and the type
    console.log(body.query.regexp);
    
    client.search({index:'scotch2.io-tutorial',  body:body, type:'cities_list'})
    .then(results => {
       // console.log('success---->',results);
        console.log("HITSSSSSSSSSSSSSSSS",results.hits);
        
      res.send(results.hits);
    })
    .catch(err=>{

      console.log('error-------->',err)
      res.send([]);
    });
  
  });

  app .listen( app.get( 'port' ), function(){
    console.log( 'Express server listening on port ' + app.get( 'port' ));
  } );