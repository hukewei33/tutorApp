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
const fs = require('fs');
var path = require('path');
var multer = require('multer');
const stripe = require('stripe')("sk_test_51H3MFKA4JtVDzRhwnBtxSGC9UwX4xQvj5ANvr9mOpiDWowkzvC3yOfY5H3akpGsusVAj5ybuPFV6ZTRaNO9JzhsH00sZsqEsRP");


const app = express();
app.use(express.json())
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
  level: [Number],
  kind: [String],
  time: String,
  date: String,
  tutorID: String,
  studentID: String,
  tutorName: String,
  studentName: String,
  studentReviews:[],
  studentLevel:Number,
  tutorReviews:[],
  tutorCatagory:String,
  tutorCount:Number,
  zoomLink: String,
  tutorImg:{
      data: Buffer,
      contentType: String
  },
  studentImg:{
      data: Buffer,
      contentType: String
  }
}
//create model for offer and match ------------------------------------------------------------------------------------------------------------------------
const Offer = mongoose.model("offer", offerSchema);
const Match = mongoose.model("match", offerSchema);
const Fulfil = mongoose.model("fulfill", offerSchema);
const Expire = mongoose.model("expire", offerSchema);
//make schema for accountInfo ------------------------------------------------------------------------------------------------------------------------


const accountInfoSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  yob:Number,
  gender: String,
  credits: Number,
  accountType:String,
  schoolYear:Number,
  currentSchool:String,
  tutorCatagory:String,
  secondary:String,
  postSecondary:String,
  underGrad:String,
  postGrad:String,
  tutorCount:Number,
  reviews: [],
  hasImg:Number,
  img:{
      data: Buffer,
      contentType: String
  }
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



//code for images
//create model for images-------------------------------------------------------------------------------------------------------------------------------------------------------

var imageSchema = new mongoose.Schema({
    name: String,
    desc: String,
    img:
    {
        data: Buffer,
        contentType: String
    }
});
var imgModel =  new mongoose.model('Image', imageSchema);

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});

var upload = multer({ storage: storage });



// Retriving the image
app.get('/img', (req, res) => {
	imgModel.find({}, (err, items) => {
		if (err) {
			console.log(err);
		}
		else {
			res.render('img', { items: items });
		}
	});
});

// Uploading the image
app.post('/img', upload.single('image'), (req, res, next) => {

    var obj = {
        name: req.body.name,
        desc: req.body.desc,
        img: {
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
            contentType: 'image/png'
        }
    }
    imgModel.create(obj, (err, item) => {
        if (err) {
            console.log(err);
        }
        else {
            item.save();
            res.redirect('/img');
        }
    });
});

app.get("/imgUpload", function(req, res) {
  if (req.isAuthenticated()) {
    loggedinRender(req,res,"imgUpload");
  } else {
    res.redirect("/login");
  }
});

app.post("/imgUpload", upload.single('image'),function(req,res){
  var obj = {
          data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
          contentType: 'image/png'
  }
  Account.findOne({_id: req.cookies.userData.userid},function(err,result){
    result.hasImg=1;
    result.img = obj;
    result.save();
    makeToCache(req,res,true);
    //remake userData
    res.clearCookie("userData");
    let users = {
      userid: result._id,
      userName: result.firstName,
      userBalance: result.credits,
      userType:result.accountType,
      hasImg:1
    }
    res.cookie("userData", users);
    res.redirect("/home");
  })
});












//email intergration ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
let transporter = nodeMailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'instanttutorsreminder@gmail.com',
    pass: process.env.EMAIL_PW
    //pass:'getTheBread'
  }
});


//landing page ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    var userBalance = req.cookies.userData.userBalance;
    res.render("index", {
      balance:userBalance,
      loggedin: true
    });
  } else {
    res.render("index", {
      loggedin: false
    });
  }
});

//login page ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/login", function(req, res) {
  res.render("login", {
    loggedin: false,
    retry:false
  });
});


app.post("/login", function(req, res) {
const userDetail = new User({
  username: req.body.username,
  password: req.body.password
});

req.login(userDetail, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local', function(err, user, info) {
        if (err) {
          return next(err);
        }
        if (!user) {
          res.render('login', {
            loggedin: false,
            retry:true
          });
          return;
        }
        //make cookies for good login
        Account.findOne({
          email: req.body.username
        }, function(err, result) {
          if (err) console.log(err)
          //make cookies
          let users = {
            userid: result._id,
            userName: result.firstName,
            userBalance: result.credits,
            userType:result.accountType,
            hasImg:result.hasImg
          }

          let toCache = {
            account:true,
            accountExist:false
          }
          //add cookies
          res.cookie("userData", users);
          res.cookie("toCache",toCache);
          res.redirect("/home");
        });
      })(req, res);
}
});
});


//register email ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/registerEmail", function(req, res) {
  res.render("registerEmail",{loggedin:false,retry:false});
});

app.post("/registerEmail",function(req,res){
  const email = req.body.requestedEmail;
  //make sure that email is not registered
  User.findOne({username: email}, function(err, result){
    if (err) console.log(err);
    //user does not exist and creating account
    if (result === null) {
      res.render("registerPW",{loggedin:false,email:email});
    }
    //email already registered
    else{
      res.render("registerEmail",{loggedin:false,retry:true});
    }
  });
});


//register PW ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.post("/registerPW",function(req,res){
  console.log("got here");
  User.register({
    username: req.body.requestedEmail
  }, req.body.requestedPW, function(err, user) {
    if (err) {
      console.log(err);
    } else {
      //also create account info
      const newAccount = new Account({
        email: req.body.requestedEmail,
        firstName: "Update Now!",
        lastName: "Update Now!",
        yob:0,
        gender: "Update Now!",
        credits: 10,
        accountType:"Update Now!",
        schoolYear:0,
        currentSchool:"Update Now!",
        tutorCatagory:"Update Now!",
        secondary:"Update Now!",
        postSecondary:"Update Now!",
        underGrad:"Update Now!",
        postGrad:"Update Now!",
        tutorCount:0,
        hasImg:0
      })
      newAccount.save();

      res.redirect("/login");
    }
  });

});

//register choice ------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/registerChoice", function(req, res) {
  loggedinRender(req,res,"registerChoice");
});


app.post("/registerChoice",function(req,res){
  var requestedAccountType= req.body.accountType;
  if(requestedAccountType==="student"){
    loggedinRender(req,res,"studentSignUp");
  }
  else{
    loggedinRender(req,res,"tutorSignUp");
  }
});


function loggedinRender(req,res,path){
  var userBalance = req.cookies.userData.userBalance;
  res.render(path,{loggedin:true,balance:userBalance});
}


//student signup --------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/studentSignUp", function(req, res) {
  if (req.isAuthenticated()) {
    loggedinRender(req,res,"studentSignUp");
  } else {
    res.redirect("/login");
  }
});

app.post("/studentSignUp",function(req,res){
  var school = req.body.schoolName;
  var year = parseInt(req.body.schoolYear);
  Account.findOne({
    _id: req.cookies.userData.userid
  }, function(err, result) {
    if (err) console.log(err);
    result.currentSchool = school;
    result.schoolYear = year;
    result.accountType = "student";
    result.save();
    //clear prev cookies
    makeUserData(res,result);
    makeToCache(req,res,true);
    res.redirect("/home");
  });
});

function makeUserData(res,result){
  res.clearCookie("userData");
  let users = {
    userid: result._id,
    userName: result.firstName,
    userBalance: result.credits,
    userType:result.accountType,
    hasImg : result.hasImg
  }
  res.cookie("userData", users);
}

function makeToCache(req,res,account){
  //initialise new cookie
  let toCache = {
    account:account,
    accountExist:req.cookies.toCache.accountExist,
  }
  //clear old one
  res.clearCookie("toCache");
  //make new cookie
  res.cookie("toCache",toCache);
}

//tutor signup --------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/tutorSignUp", function(req, res) {
  if (req.isAuthenticated()) {
    loggedinRender(req,res,"tutorSignUp");
  } else {
    res.redirect("/login");
  }
});

app.post("/tutorSignUp",function(req,res){
  var secondary = req.body.secondary;
  var postSecondary = req.body.postSecondary;
  var underGrad = req.body.underGrad;
  var postGrad = req.body.postGrad;
  var tutorCatagory = req.body.tutorCatagory;
  Account.findOne({
    _id: req.cookies.userData.userid
  }, function(err, result) {
    if (err) console.log(err);
    result.secondary = secondary;
    result.postSecondary = postSecondary;
    result.underGrad = underGrad;
    result.postGrad = postGrad;
    result.tutorCatagory = tutorCatagory;
    result.accountType = "tutor";
    result.save();
    makeUserData(res,result);
    makeToCache(req,res,true);
    res.redirect("/home");
  });
});

//update -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/update", function(req, res) {
  if (req.isAuthenticated()) {
    loggedinRender(req,res,"update");
  } else {
    res.redirect("/login");
  }
});

app.post("/update", function(req, res) {
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const yob = req.body.yob;
  const gender = req.body.gender;
  Account.findOne({
    _id: req.cookies.userData.userid
  }, function(err, result) {
    if (err) console.log(err);
    result.firstName = firstName;
    result.lastName = lastName;
    result.yob = yob;
    result.gender = gender;
    result.save();
    //clear prev cookies
    makeUserData(res,result);
    makeToCache(req,res,true);
    res.redirect("/home");
  });
});

//logout -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/logout", function(req, res) {
  req.logout();
  res.clearCookie("userData");
  res.clearCookie("toCache");
  res.clearCookie("accData");
  res.redirect("/");
});

//home page -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/home", function(req, res) {
  if (req.isAuthenticated()) {
    //case for user has not updated userName
    if(req.cookies.userData.userName==="Update Now!"){
      return res.redirect("/update");
    }
    //case for user have not updated account type specific info
    if(req.cookies.userData.userType==="Update Now!"){
      return res.redirect("/registerChoice");
    }
    console.log(req.cookies.userData.hasImg);
    if(req.cookies.userData.hasImg==0){
      return res.redirect("/imgUpload");
    }

    //cache account info is required
    if(req.cookies.toCache.account){
      //clear cookies is required
      if(req.cookies.toCache.accountExist){
        res.clearCookie("accData");
      }
      //use userid to get infro to cache
      console.log("using id is "+req.cookies.userData.userid);
      return Account.findOne({
        _id: req.cookies.userData.userid
      }, function(err, result) {
        if (err) console.log(err);
        //make the cookies without image
        let resultWrapper = {
          _id: req.cookies.userData.userid,
          email: result.email,
          firstName: result.firstName,
          lastName: result.lastName,
          yob:result.yob,
          gender: result.gender,
          credits:result.credits,
          accountType:result.accountType,
          schoolYear:result.schoolYear,
          currentSchool:result.currentSchool,
          tutorCatagory:result.tutorCatagory,
          secondary:result.secondary,
          postSecondary:result.postSecondary,
          underGrad:result.underGrad,
          postGrad:result.postGrad,
          tutorCount:result.tutorCatagory,
          reviews: result.reviews
        }

        let accData = {
          info:resultWrapper
        }
        res.cookie("accData",accData);
        res.clearCookie("toCache");
        let toCache = {
          account:false,
          accountExist:true
        }
        //add cookies
        res.cookie("toCache",toCache);

        jobInfo(req,res);
      });
    }
    return jobInfo(req,res);

  } else {
    return res.redirect("/login");
  }
});

function jobInfo(req,res){
  var userID = req.cookies.userData.userid;
  var userBalance = req.cookies.userData.userBalance;
    //search for jobs unmatched
    Offer.find({
      tutorID: userID
    }, function(err, pending) {
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
            Fulfil.find({
              tutorID: userID
            }, function(err, pastMatches) {
              if (err) console.log(err);
              //find list of past lessons
              Fulfil.find({
                studentID: userID
              }, function(err, pastLessons) {
                if (err) console.log(err);
                Expire.find({tutorID:userID},function(err,expiredOffer){
                  if (err) console.log(err);
                  //cache jobs
                  let jobs = {
                    jobInfo: pending,
                    matchInfo: matches,
                    lessonInfo: lessons,
                    pastMatchInfo: pastMatches,
                    pastLessonInfo: pastLessons,
                    expiredOffer:expiredOffer
                  }
                  //render page

                  homeRender(req,res,jobs);
                });
                });
              });
            });
          });
        });
}

function homeRender(req,res,jobs){
    var userBalance = req.cookies.userData.userBalance;
    var path= req.cookies.userData.userType +"Home";
    res.render(path,{balance:userBalance,loggedin:true,jobsLists:jobs});
}



//tutors -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/profile", function(req, res) {
  if (req.isAuthenticated()) {
    //only can access profile page if accData cached
    var accDataExist = req.cookies.toCache.accountExist;
    var accType = req.cookies.userData.userType;
    console.log("profile using if"+req.cookies.userData.userid);
    if(!accDataExist){
      console.log("entered here");
      return res.redirect("/home");
    }
    else{
      Account.findOne({
        _id: req.cookies.userData.userid
      }, function(err, result) {
        if (err) console.log(err);
        console.log("in here");
        var img = result.img;
        //case on kind of accountType
        if(accType==="student"){
          //render profile page for student
          return res.render("studentProfile",{loggedin:true,accInfo:req.cookies.accData,balance:req.cookies.userData.userBalance,userData:req.cookies.userData,img:img});

        }else{
          //render profile page for tutor
          return res.render("tutorProfile",{loggedin:true,accInfo:req.cookies.accData,balance:req.cookies.userData.userBalance,userData:req.cookies.userData,img:img});
        }
      })


    }
  } else {
    res.redirect("/login");
  }
});



//tutors -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/tutors", function(req, res) {
  if (req.isAuthenticated()) {
    loggedinRender(req,res,"tutors");
  } else {
    res.redirect("/login");
  }
});

app.post("/tutors", function(req, res) {
  console.log("tutor id is"+req.cookies.accData.info._id);
  const subjectRequested = req.body.subject;
  var levelRequested = req.body.levels;
  var kindRequested = req.body.kind;
  const dateRequested = req.body.date;
  var timeRequested = req.body.time;
  const tutorID = req.cookies.accData.info._id;
  const tutorName = req.cookies.userData.userName;
  const tutorReview=req.cookies.accData.info.reviews;
  const tutorCount = req.cookies.accData.info.tutorCount;
  //to do: intergrate tutor nickname into each offer

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
  Account.findOne({
    _id: req.cookies.userData.userid
  }, function(err, result) {
    if (err) console.log(err);
    console.log("in here");
    var img = result.img;
    timeRequested.forEach(function(timeSlot) {
      var newOffer = new Offer({
        subject: subjectRequested,
        level: levelRequested,
        kind: kindRequested,
        date: dateRequested,
        time: timeSlot,
        tutorID: tutorID,
        studentID: "null",
        tutorName: tutorName,
        studentName: "null",
        tutorReviews:tutorReview,
        tutorJobsCount:tutorCount,
        zoomLink: "Update Now",
        tutorImg:img
      });
      newOffer.save();
      //experiment with cron
      //to implement:
      //require check in at scheduled time?
      //move auto move from unmatched to expired unmatch DB
      //and also send an email

      // var plannedTime = new Date(dateRequested + "T" + timeSlot + "+08:00");
      //
      // var mString = plannedTime.getMonth() + 1;
      // var dString = plannedTime.getDate();
      // var hString = plannedTime.getHours() - 1;
      //
      // var cronString = "* " + hString + " " + dString + " " + mString + " *"
      // console.log(plannedTime);
      // console.log(cronString);
      // var task = cron.schedule(cronString, function() {
      //   console.log("running cron for " + tutorAccount.nickName);
      //   task.destroy();
      // })
    })
    res.redirect("/tutors");
  })

});

//
// function makeToCacheJobs(req,res,jobs){
//   console.log("changing toCache job info")
//   //initialise new cookie
//   let toCache = {
//     account:req.cookies.toCache.account,
//     accountExist:req.cookies.toCache.accountExist,
//     jobs:jobs,
//     jobsExist:req.cookies.toCache.jobsExist
//   }
//   //clear old one
//   res.clearCookie("toCache");
//   //make new cookie
//   res.cookie("toCache",toCache);
// }

//students -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/students", function(req, res) {
  if (req.isAuthenticated()) {
    loggedinRender(req,res,"students");
  } else {
    res.redirect("/login");
  }
});

app.post("/students", function(req, res) {
  const subjectRequested = req.body.subject;
  const levelRequested = req.cookies.accData.schoolYear;
  const kindRequested = req.body.kind;
  const dateRequested = req.body.date;
  const timeRequested = req.body.time;
  var userBalance = req.cookies.userData.userBalance;

  var perfectList = [];
  var sameTimeList = [];
  var sameDateList = [];


  Offer.find({
    $and: [{
      subject: subjectRequested
    }
    //,{level: levelRequested}
    , {
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
          loggedin:true,
          perfectList: perfectList,
          sameTimeList: sameTimeList,
          sameDateList: sameDateList,
          balance: userBalance,
          userData:req.cookies.userData,
          searchSubject:subjectRequested,
          searchLevel:levelRequested,
          searchKind:kindRequested
        });
      }
    }
  });
});

//account infromation -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

// app.get("/account", function(req, res) {
//   if (req.isAuthenticated()) {
//     const userID = req.cookies.accData._id;
//     var userBalance = req.cookies.userData.userBalance;
//     console.log("user ID used is " + userID)
//     //find list of jobs
//     Offer.find({
//       tutorID: userID
//     }, function(err, jobs) {
//       if (err) console.log(err);
//       //find user account info
//       Account.findOne({
//         _id: userID
//       }, function(err, accountInfo) {
//         if (err) console.log(err);
//         //find list of matched job offers
//         Match.find({
//           tutorID: userID
//         }, function(err, matches) {
//           if (err) console.log(err);
//           //find list of accepted lessons
//           Match.find({
//             studentID: userID
//           }, function(err, lessons) {
//             if (err) console.log(err);
//             //find list of past matches
//             Fulfil.find({
//               tutorID: userID
//             }, function(err, pastMatches) {
//               if (err) console.log(err);
//               //find list of past lessons
//               Fulfil.find({
//                 studentID: userID
//               }, function(err, pastLessons) {
//                 if (err) console.log(err);
//                 console.log("accountInfo is " + accountInfo)
//                 res.render("account", {
//                   accInfo: accountInfo,
//                   jobInfo: jobs,
//                   matchInfo: matches,
//                   lessonInfo: lessons,
//                   pastMatchInfo: pastMatches,
//                   pastLessonInfo: pastLessons,
//                   balance: userBalance
//                 });
//               });
//             });
//           });
//         });
//       });
//     });
//   } else {
//     res.redirect("/login");
//   }
// });

//view -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

// app.post("/view", function(req, res) {
//   if (req.isAuthenticated()) {
//     const selectedID = req.body.selectedID;
//     var userBalance = req.cookies.userData.userBalance;
//     if (userBalance < 1) {
//       res.redirect("/buyCredits");
//     }
//     Offer.findById(selectedID, function(err, result) {
//       if (err) console.log(err);
//       else {
//         console.log(result);
//         res.render("view", {
//           match: result,
//           balance: userBalance
//         });
//       }
//     });
//   } else {
//     res.redirect("/login");
//   }
// });




//booking -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.post("/booking", function(req, res) {
  if (req.isAuthenticated()) {
    const selectedID = req.body.selectedID;
    const selectedKind = req.body.selectedKind;
    const userID = req.cookies.accData.info._id;
    const userName = req.cookies.userData.userName;
    const userLevel = req.cookies.accData.info.schoolYear;
    const userReviews = req.cookies.accData.info.studentReviews;
    Offer.findById(selectedID, function(err, findRes) {
      if (err) console.log(err);
      //conduct transaction of credits
      Account.findOne({
        _id: userID
      }, function(err, studentAccount) {
        if (err) console.log(err);
        var oldAmount1 = studentAccount.credits;
        //student account has not enough buyCredits
        if (oldAmount1 <= 1) {
          console.log("not enough money");
          res.redirect("/buyCredits");
        }
        studentAccount.credits = oldAmount1 - 1;
        studentAccount.save();
        Account.findOne({
          _id: findRes.tutorID
        }, function(err, tutorAccount) {
          if (err) console.log(err);
          var oldAmount2 = tutorAccount.credits;
          tutorAccount.credits = oldAmount2 + 1;
          tutorAccount.save();
        });
        //update student info
        findRes.studentID = userID;
        findRes.studentName = userName;
        findRes.studentReviews=userReviews;
        findRes.studentLevel = userLevel;
        findRes.kind=selectedKind;
        findRes.studentImg = studentAccount.img;
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
        sendEmail(outPut, "You have a new job!", findRes.tutorID);

        findRes.remove();
      });

    });

    // makeToCacheJobs(req,res,true);
    return res.redirect("/students");
  } else {
    res.redirect("/login");
  }
});


function sendEmail(output, subject, client) {
  let mailOption = {
    from: 'instanttutorsreminder@gmail.com',
    to: client,
    subject: subject,
    text: "new job",
    html: output
  };

  transporter.sendMail(mailOption, function(err, data) {
    if (err) console.log(err);
    else console.log("mail sent");
  });
}


//submission of links -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.post("/submitLink", function(req, res) {
  const zoomLink = req.body.zoomLink;
  const matchID = req.body.matchID;
  Match.findById(matchID, function(err, result) {
    if (err) console.log(err);
    result.zoomLink = zoomLink;
    result.save();
  });

  //update toCache cookie
  const acc = req.cookies.toCache.account;
  const accExist = req.cookies.toCache.accountExist;
  res.clearCookie("toCache");
  makeToCacheJobs(req,res,true);
  res.redirect("/home");
});


//submission of review -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.post("/review", function(req, res) {
  const revieweeID = req.body.revieweeID;
  const revieweeName = req.body.revieweeName;
  var userBalance = req.cookies.userData.userBalance;
  res.render("review", {
    revieweeID: revieweeID,
    balance: userBalance,
    loggedin:true,
    revieweeName:revieweeName
  });
});


//update of review -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.post("/newReview", function(req, res) {
  const userID = req.cookies.accData._id;
  const userName = req.cookies.userData.userName;
  const revieweeID = req.body.revieweeID;
  const userRating = req.body.userRating;
  const userReview = req.body.userReview;
  //make the review object
  var newReview = {
    rating: userRating,
    reviewer: userID,
    reviewerName: userName,
    review: userReview
  };
  Account.findOne({
    _id: revieweeID
  }, function(err, reviewee) {
    if (err) console.log(err);
    var tmpArray = reviewee.reviews;
    tmpArray.push(newReview);
    reviewee.reviews = tmpArray;
    reviewee.save();
    console.log("review updated");
  });
  res.redirect("/home");
});

//credits -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------

app.get("/buyCredits", function(req, res) {
  if (req.isAuthenticated()) {
    var userBalance = req.cookies.userData.userBalance;
    return res.render("buyCredits", {
      balance: userBalance,loggedin:true
    });
  } else {
    res.redirect("/login");
  }
});

app.post('/buyCredits', function(req, res) {
  let total = 0;
  let totalCredit = 0;
  console.log(req.body.items);
  req.body.items.forEach(function(item) {
    var i = item.id;
    var q = item.quantity;
    switch (i) {
      case '1':
        total = total + 1000 * q;
        totalCredit = totalCredit + 10 * q
        break;
      case '2':
        total = total + 1500 * q;
        totalCredit = totalCredit + 20 * q
        break;
      default:
        console.log("error id");
    }
  })

  //make cookies
  let users = {
    userid: req.cookies.userData.userid,
    userName: req.cookies.userData.userName,
    userBalance: req.cookies.userData.userBalance + totalCredit,
    userType:req.cookies.userData.userType,
    hasImg:req.cookies.userData.hasImg
  }
  //add cookies
  res.clearCookie("userData");
  res.cookie("userData", users);

  console.log("total is" + total)
  stripe.charges.create({
    amount: total,
    source: req.body.stripeTokenId,
    currency: 'sgd'
  }).then(function() {
    console.log('Charge Successful')
    res.json({
      message: 'Successfully purchased items'
    })

    //update credits in data base
    Account.findOne({
      _id: req.cookies.userData.userid
    }, function(err, account) {
      if (err) console.log(err);
      var oldAmount = account.credits;
      account.credits = oldAmount + totalCredit;
      account.save();

    });
  }).catch(function() {
    console.log('Charge Fail')
    res.status(500).end()
  })
})



// update log prediodically-------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
cron.schedule('*/30 * * * *', () => {
  console.log('running a task every hour');
  var now = new Date();
  console.log(now);
  //look thorugh matches
  Match.find({}, function(err, matchList) {
    matchList.forEach(function(elem) {
      var dateString = elem.date;
      var timeString = elem.time;
      //set to gmt +8 for singapore time
      var d = new Date(dateString + "T" + timeString + "+08:00");
      console.log(d);
      //move matches that have passed into furfill DB
      if (d < now) {
        let swap = new(mongoose.model('fulfill'))(elem);
        swap._id = mongoose.Types.ObjectId();
        swap.isNew = true;
        swap.save();
        elem.remove();
        //also update the number of jobs completed for tutor
        Account.findOne({_id:swap.tutorID},function(err,tutorAcc){
          if(err)console.log(err);
          tutorAcc.tutorCount = tutorAcc.tutorCount +1;
          tutorAcc.save();
        })
      }
    });
  });
  //look thorugh offers
  Offers.find({}, function(err, offerList) {
    offerList.forEach(function(elem) {
      var dateString = elem.date;
      var timeString = elem.time;
      //set to gmt +8 for singapore time
      var d = new Date(dateString + "T" + timeString + "+08:00");
      console.log(d);
      //move offers that have passed into expired DB
      if (d < now) {
        let swap = new(mongoose.model('expire'))(elem);
        swap._id = mongoose.Types.ObjectId();
        swap.isNew = true;
        swap.save();
        elem.remove();
      }
    });
  });
});

//view other people account -------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------
app.get("/acc/:paramName", function(req, res){
  const requestedID = req.params.paramName;
  var userBalance = req.cookies.userData.userBalance;
  console.log("in account view");
  Account.findOne({
    _id: requestedID
  }, function(err, result) {
    if (err) console.log(err);
    //make the cookies
    let accData = {
      info:result
    }
    if(result.userType==="student"){
      //render profile page for student
      return res.render("studentProfilePublic",{loggedin:true,accInfo:accData,balance:req.cookies.userData.userBalance});

    }else{
      //render profile page for tutor
      return res.render("tutorProfilePublic",{loggedin:true,accInfo:accData,balance:req.cookies.userData.userBalance});
    }
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
