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





const app = express();
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(bodyParser.urlencoded({
  extended: true
}));
//use local files
app.use(express.static("public"));

app.use(session({
  secret: process.env.PASSPORT_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb+srv://" + process.env.DB_USER + ":" + process.env.DB_PW + "@cluster0-h1iil.mongodb.net/eduDaddyDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);

const offerSchema = {
  subject: String,
  level: [String],
  kind: [String],
  time: String,
  date: String,
  tutorID: String
}

const Offer = mongoose.model("offer", offerSchema);


const accountInfoSchema = {
  email: String,
  nickName: String,
  age: String,
  gender: String,
  school: String,
  credits: Number
}

const Account = mongoose.model("account", accountInfoSchema);

const userSchema = new mongoose.Schema({
  email: String,
  password: String
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("home");
  } else {
    res.render("index", {
      placeholder: "testing"
    });
  }

});

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
    if (result === null) {
      console.log("lets register " + requestedUserName);
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
            res.redirect("/home");
          });
        }
      });
    } else {
      console.log("duplicate found");
      res.redirect("/register");
    }
  })
});

app.get("/logout", function(req, res) {
  req.logout();
  res.clearCookie("userData");
  res.redirect("/");
});


app.get("/home", function(req, res) {
  if (req.isAuthenticated()) {
    console.log(req.cookies.userData.userid);
    res.render("home");
  } else {
    res.redirect("/login");
  }
});

app.get("/tutors", function(req, res) {
  if (req.isAuthenticated()) {
    console.log("going to tutors page");
    console.log(req.cookies.userData.userid);
    res.render("tutors", {
      tid: req.cookies.userData.userid
    });
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
  const tutorID = req.body.tutorID;

  console.log(req.body);
  console.log(typeof dateRequested);
  console.log(typeof timeRequested);

  if (typeof timeRequested === "string") {
    timeRequested = [req.body.time];
  }
  if (typeof levelRequested === 'string') {
    console.log("single levels");
    levelRequested = [req.body.levels];
  }
  if (typeof kindRequested === 'string') {
    console.log("single kind");
    kindRequested = [req.body.kind];
  }

  timeRequested.forEach(function(timeSlot) {
    var newOffer = new Offer({
      subject: subjectRequested,
      level: levelRequested,
      kind: kindRequested,
      date: dateRequested,
      time: timeSlot,
      tutorID: tutorID
    });
    newOffer.save();
  })


  res.redirect("/tutors");
});



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


app.get("/account", function(req, res) {
  if (req.isAuthenticated()) {
    //make list of jobs
    const userID = req.cookies.userData.userid;
    console.log("the user id used in search is"+userID);
    //find list of jobs
    Offer.find({tutorID:userID}, function(err, jobs) {
      if (err) console.log(err);
      else {
        console.log(jobs);
        Account.findOne({email: userID}, function(err, accountInfo) {
          if (err) console.log(err);
          else {
            console.log(jobs);
            res.render("account", {
              accInfo: accountInfo,
              jobInfo: jobs
            });
          }
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server started on port 3000");
});
