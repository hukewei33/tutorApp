//load express
const express = require("express");
const app = express();

//load ejs
app.set('view engine', 'ejs');
//load body parser
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({
  extended: true
}));

//load mongoose
const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://kenny:test123@cluster0-h1iil.mongodb.net/eduDaddyDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true}
);

const offerSchema = {
  subject:String,
  level:[String],
  kind:[String],
  time:String,
  date:String
}

const Offer = mongoose.model("offer",offerSchema);

//use local files
app.use(express.static("public"));

//get index

app.get("/",function(req,res){
  res.render("index");
});

app.get("/tutors",function(req,res){
  res.render("tutors");
});

app.post("/tutors",function(req,res){
  const subjectRequested = req.body.subject;
  var levelRequested = req.body.levels;
  var kindRequested = req.body.kind;
  const dateRequested = req.body.date;
  var timeRequested = req.body.time;

  console.log(req.body);
  console.log(typeof dateRequested);
  console.log(typeof timeRequested);

  if(typeof timeRequested === "string"){
    timeRequested = [req.body.time];
  }
  if(typeof levelRequested === 'string'){
    console.log("single levels");
    levelRequested = [req.body.levels];
  }
  if(typeof kindRequested=== 'string'){
    console.log("single kind");
    kindRequested=[req.body.kind];
  }

  timeRequested.forEach(function(timeSlot){
    var newOffer = new Offer({
      subject:subjectRequested,
      level:levelRequested,
      kind:kindRequested,
      date:dateRequested,
      time:timeSlot
    });
    newOffer.save();
  })


  res.redirect("/tutors");
});



app.get("/students",function(req,res){
  res.render("students");
});

app.post("/students",function(req,res){
  const subjectRequested = req.body.subject;
  const levelRequested = req.body.levels;
  const kindRequested = req.body.kind;
  const dateRequested = req.body.date;
  const timeRequested = req.body.time;

  var perfectList =[];
  var sameTimeList = [];
  var sameDateList = [];


  Offer.find({$and:[{subject:subjectRequested},{level:levelRequested},{kind:kindRequested}]},function(err,results){
    if(err)console.log("error");
    else{
      console.log(results);
      //no reslts found
      if(results.length == 0) {
        console.log("no results found");
        res.redirect("/students");
      }
      //results found
      else{
        console.log("matches found");
        //perform matching and sorting
        //look for perfect match and showcase first
        results.forEach(function(match){
          var timeMatch = (match.time===timeRequested);
          var dateMatch = (match.date===dateRequested);
          if(timeMatch&&dateMatch){
            perfectList.push(match);
          }
          else{
            if(timeMatch) sameTimeList.push(match);
            if(dateMatch)sameDateList.push(match);
          }
        });
        //to do: implement sort in arrays

        res.render("studentsResult",{perfectList:perfectList,
        sameTimeList:sameTimeList,
        sameDateList:sameDateList
      });
      }
    }
});
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server started on port 3000");
});
