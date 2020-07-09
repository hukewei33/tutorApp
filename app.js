require('dotenv').config();

//load express
const express = require("express");
//load mongoose
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
var cookieParser = require('cookie-parser');
const nodeMailer = require('nodemailer');
var cron = require('node-cron');



const app = express();
//use ejs ------------------------------------------------------------------------------------------------------------------------
app.set('view engine', 'ejs');
//use cookies------------------------------------------------------------------------------------------------------------------------
app.use(cookieParser());
//use body parser------------------------------------------------------------------------------------------------------------------------
app.use(bodyParser.urlencoded({
  extended: true
}));
//use local files------------------------------------------------------------------------------------------------------------------------
app.use(express.static("public"));
//use passport ------------------------------------------------------------------------------------------------------------------------
app.use(session({
  secret: process.env.PASSPORT_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//connect to the mongodb Atlas------------------------------------------------------------------------------------------------------------------------
mongoose.connect("mongodb+srv://" + process.env.DB_USER + ":" + process.env.DB_PW + "@cluster0-h1iil.mongodb.net/eduDaddyDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);
//make schema for offers and matches ------------------------------------------------------------------------------------------------------------------------
const offerSchema = {
  subject: String,
  level: [String],
  kind: [String],
  time: String,
  date: String,
  tutorID: String,
  studentID: String,
  tutorNickName:String,
  zoomLink:String
}
//create model for offer and match ------------------------------------------------------------------------------------------------------------------------
const Offer = mongoose.model("offer", offerSchema);
const Match = mongoose.model("match", offerSchema);
const Fulfil = mongoose.model("fulfill", offerSchema);
//make schema for accountInfo ------------------------------------------------------------------------------------------------------------------------


const accountInfoSchema = new mongoose.Schema({
  email: String,
  nickName: String,
  age: String,
  gender: String,
  school: String,
  credits: Number,
  reviews:[]
});
//create model for acountInfo ------------------------------------------------------------------------------------------------------------------------
const Account = mongoose.model("account", accountInfoSchema);
//create schema for login details ------------------------------------------------------------------------------------------------------------------------
const userSchema = new mongoose.Schema({
  email: String,
  password: String
});
//initialise plugin for passport and create model for login detials ------------------------------------------------------------------------------------------------------------------------
userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
//email intergration ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
let transporter = nodeMailer.createTransport({
  service:'gmail',
  auth:{
    user:'instanttutorsreminder@gmail.com',
    pass:process.env.EMAIL_PW
    //pass:'getTheBread'
  }
});


//landing page ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("home");
  } else {
    res.render("index", {
      placeholder: "testing"
    });
  }
});

//login page ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/login", function(req, res) {
  res.render("login");
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  //make cookie
  let users = {
    userid: req.body.username
  }
  req.login(user, function(err) {
    if (err) {
      // to do: handle incorrect login
      res.redirect("/login");
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        //add cookies
        res.cookie("userData", users);
        res.redirect("/home");
      });
    }
  });
});
//register page ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/register", function(req, res) {
  res.render("register");
});

app.post("/register", function(req, res) {
  const requestedUserName = req.body.username;
  //make sure username does not exist in database
  User.findOne({
    username: requestedUserName
  }, function(err, result) {
    console.log(result);
    if (err) console.log(err);
    //user does not exist and creating account
    if (result === null) {
      User.register({
        username: requestedUserName
      }, req.body.password, function(err, user) {
        if (err) {
          console.log(err);
          res.redirect("/register");
        } else {
          //also create account
          const newAccount = new Account({
            email: requestedUserName,
            nickName: "Update Now!",
            age: "Update Now!",
            gender: "Update Now!",
            school: "Update Now!",
            credits: 0
          })
          newAccount.save();
          //make cookie
          let users = {
            userid: req.body.username
          }
          //add cookies
          res.cookie("userData", users);
          passport.authenticate("local")(req, res, function() {
            res.redirect("/update");
          });
        }
      });
    } else {
      //if duplicate account exist then refresh page
      //to do: pop up or modal to inform user about error
      console.log("duplicate found");
      res.redirect("/register");
    }
  })
});
//logout -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/logout", function(req, res) {
  req.logout();
  res.clearCookie("userData");
  res.redirect("/");
});

//home page -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/home", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("home");
  } else {
    res.redirect("/login");
  }
});

//update -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/update", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("update");
  } else {
    res.redirect("/login");
  }
});

app.post("/update", function(req, res) {
  const nickName = req.body.nickName;
  const age = req.body.age;
  const gender = req.body.gender;
  const school = req.body.school;
  Account.findOne({
    email: req.cookies.userData.userid
  }, function(err, result) {
    if (err) console.log(err);
    result.nickName = nickName;
    result.age = age;
    result.gender = gender;
    result.school = school;
    result.save();
    res.redirect("/home");
  });
});

//tutors -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/tutors", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("tutors");
  } else {
    res.redirect("/login");
  }
});

app.post("/tutors", function(req, res) {
  const subjectRequested = req.body.subject;
  var levelRequested = req.body.levels;
  var kindRequested = req.body.kind;
  const dateRequested = req.body.date;
  var timeRequested = req.body.time;
  const tutorID = req.cookies.userData.userid;
  //to do: intergrate tutor nickname into each offer
  Account.findOne({email:tutorID},function(err,tutorAccount){
    if(err)console.log(err);
      if (typeof timeRequested === "string") {
        timeRequested = [req.body.time];
      }
      //make sure that bith variables are lists
      if (typeof levelRequested === 'string') {
        levelRequested = [req.body.levels];
      }
      if (typeof kindRequested === 'string') {
        kindRequested = [req.body.kind];
      }
      const tutorNickName = tutorAccount.nickName;
      timeRequested.forEach(function(timeSlot) {
        var newOffer = new Offer({
          subject: subjectRequested,
          level: levelRequested,
          kind: kindRequested,
          date: dateRequested,
          time: timeSlot,
          tutorID: tutorID,
          studentID: "null",
          tutorNickName:tutorNickName,
          zoomLink:"Update Now"
        });
        newOffer.save();
        //experiment with cron
        //to implement:
        //require check in at scheduled time?
        //move auto move from unmatched to expired unmatch DB
        //
        var task = cron.schedule('*/10 * * * * *',function(){
          console.log("running cron for "+ tutorAccount.nickName);
          task.destroy();
        })
      })

      res.redirect("/tutors");
  });

});


//students -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/students", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("students");
  } else {
    res.redirect("/login");
  }
});

app.post("/students", function(req, res) {
  const subjectRequested = req.body.subject;
  const levelRequested = req.body.levels;
  const kindRequested = req.body.kind;
  const dateRequested = req.body.date;
  const timeRequested = req.body.time;

  var perfectList = [];
  var sameTimeList = [];
  var sameDateList = [];


  Offer.find({
    $and: [{
      subject: subjectRequested
    }, {
      level: levelRequested
    }, {
      kind: kindRequested
    }]
  }, function(err, results) {
    if (err) console.log("error");
    else {
      console.log(results);
      //no reslts found
      if (results.length == 0) {
        console.log("no results found");
        res.redirect("/students");
      }
      //results found
      else {
        console.log("matches found");
        //perform matching and sorting
        //look for perfect match and showcase first
        results.forEach(function(match) {
          var timeMatch = (match.time === timeRequested);
          var dateMatch = (match.date === dateRequested);
          if (timeMatch && dateMatch) {
            perfectList.push(match);
          } else {
            if (timeMatch) sameTimeList.push(match);
            if (dateMatch) sameDateList.push(match);
          }
        });
        //to do: implement sort in arrays

        res.render("studentsResult", {
          perfectList: perfectList,
          sameTimeList: sameTimeList,
          sameDateList: sameDateList
        });
      }
    }
  });
});

//account infromation -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/account", function(req, res) {
  if (req.isAuthenticated()) {
    const userID = req.cookies.userData.userid;
    //find list of jobs
    Offer.find({
      tutorID: userID
    }, function(err, jobs) {
      if (err) console.log(err);
      //find user account info
      Account.findOne({
        email: userID
      }, function(err, accountInfo) {
        if (err) console.log(err);
        //find list of matched job offers
        Match.find({
          tutorID: userID
        }, function(err, matches) {
          if (err) console.log(err);
          //find list of accepted lessons
          Match.find({
            studentID: userID
          }, function(err, lessons) {
            if (err) console.log(err);
            //find list of past matches
            Fulfil.find({tutorID: userID},function(err,pastMatches){
              if (err) console.log(err);
              //find list of past lessons
              Fulfil.find({studentID: userID},function(err,pastLessons){
                if (err) console.log(err);
                res.render("account", {
                  accInfo: accountInfo,
                  jobInfo: jobs,
                  matchInfo: matches,
                  lessonInfo: lessons,
                  pastMatchInfo: pastMatches,
                  pastLessonInfo: pastLessons
                });
              });
            });
          });
        });
      });
    });
  } else {
    res.redirect("/login");
  }
});

//view -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.post("/view", function(req, res) {
  if (req.isAuthenticated()) {
    const selectedID = req.body.selectedID;
    Offer.findById(selectedID, function(err, result) {
      if (err) console.log(err);
      else {
        console.log(result);
        res.render("view", {
          match: result
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});

//booking -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.post("/booking", function(req, res) {
  if (req.isAuthenticated()) {
    const selectedID = req.body.selectedID;
    const userID = req.cookies.userData.userid;

    Offer.findById(selectedID, function(err, findRes) {
      if (err) console.log(err);
      //update student info
      findRes.studentID = userID;
      findRes.save();
      //put in Match collection
      let swap = new(mongoose.model('match'))(findRes);
      swap._id = mongoose.Types.ObjectId();
      swap.isNew = true;
      swap.save();
      const outPut = `
      <p> You have a new job!</p>
      <h2>Job details</h2>
      <ul>
      <li>Subject : ${findRes.subject}</li>
      <li>date : ${findRes.date}</li>
      <li>time : ${findRes.time}</li>
      </ul>
      `
      let mailOption = {
        from:'instanttutorsreminder@gmail.com',
        to:findRes.tutorID,
        subject:'You have a new job!',
        text:"new job",
        html:outPut
      };

      transporter.sendMail(mailOption,function(err,data){
        if(err)console.log(err);
        else console.log("mail sent");
      });
      //conduct transaction of credits
      Account.findOne({email:userID},function(err,studentAccount){
        if(err)console.log(err);
        var oldAmount1 = studentAccount.credits;
        studentAccount.credits = oldAmount1-1;
        studentAccount.save();
        Account.findOne({email:findRes.tutorID},function(err,tutorAccount){
          if(err)console.log(err);
          var oldAmount2 = tutorAccount.credits;
          tutorAccount.credits = oldAmount2+1;
          tutorAccount.save();
        });
      });
      findRes.remove();
    });

    // Offer.findById(selectedID, function(err, findRes) {
    //   if (err) console.log(err);
    //   //remove the old offer from db
    //   findRes.remove();
    // });
    res.redirect("/students");
  } else {
    res.redirect("/login");
  }
});


//submission of links -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.post("/submitLink",function(req,res){
  const zoomLink = req.body.zoomLink;
  const matchID = req.body.matchID;
  Match.findById(matchID,function(err,result){
    if(err) console.log(err);
    result.zoomLink = zoomLink;
    result.save();
  });
  res.redirect("/account");
});


//submission of review -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.post("/review",function(req,res){
  const revieweeID = req.body.revieweeID;
  res.render("review",{
    revieweeID:revieweeID
  });
});


//update of review -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.post("/newReview",function(req,res){
  const userID = req.cookies.userData.userid;
  const revieweeID = req.body.revieweeID;
  const userRating = req.body.userRating;
  const userReview = req.body.userReview;
  //make the review object
  var newReview = {
    rating:userRating,
    reviewer:userID,
    review:userReview
  };
  Account.findOne({email:revieweeID},function(err,reviewee){
    if(err)console.log(err);
    var tmpArray = reviewee.reviews;
    tmpArray.push(newReview);
    reviewee.reviews = tmpArray;
    reviewee.save();
    console.log("review updated");
  });
  res.redirect("/account");
});



// update log prediodically-------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
cron.schedule('* */1 * * *', () => {
  console.log('running a task every hour');
  var now = new Date();
  Match.find({},function(err,matchList){
    matchList.forEach(function(elem){
      var dateString = elem.date;
      var timeString = elem.time;
      //set to gmt +8 for singapore time
      var d = new Date(dateString+"T"+timeString+"+08:00");
      console.log(d);
      //move matches that have passed into furfill DB
      if(d<now){
        let swap = new(mongoose.model('fulfill'))(elem);
        swap._id = mongoose.Types.ObjectId();
        swap.isNew = true;
        swap.save();
        elem.remove();
      }

    });
  });
});

//start listening at ports -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server started on port 3000");
});
