const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs')
const path = require("path")

require('dotenv').config();


const User = require("./models/Users");
const TravelStory = require('./models/TravelStory');
const { authenticateToken } = require("./utilities");
const upload = require("./multer");
const { $regex, $options } = require("sift");


mongoose.connect(process.env.MONGO_URL)

const app = express();
const port = 8000;
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Adjust for your needs
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204); // Handles preflight request
    }
    next();
});
app.use(cors());
// app.use(cors({
//     origin: "*", 
//     methods: ["get","post","put","patch","delete"]
// }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
app.use("/assets", express.static(path.join(__dirname, "assets")))

// Create Account
app.post('/create-account', async(req, res) => {
    const { fullName, email, password } = req.body;

    if(!fullName || !email || !password){
        return res.status(400).json({
            error: true,
            message: "All fields are required"
        });
    }

    const isUser = await User.findOne({email});
    if(isUser){
        return res.status(400).json({
            error: true,
            message: "User already exists"
        })
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
        fullName,
        email,
        password: hashedPassword,
    });
    await user.save();
    const accessToken = jwt.sign({userId : user._id}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '72h'});

    return res.status(201).json({
        error: false,
        user: { fullName: user.fullName, email: user.email },
        accessToken,
        message: "Registeration Successful"
    })
});

// Login
app.post('/login', async(req, res) => {
    const {email, password} = req.body;

    if(!email || !password){
        return res.status(400).json({message: "Email and Password are required"})
    }

    const user = await User.findOne({email});
    if(!user){
        return res.status(400).json({message: "User not found"});
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if(!isPasswordValid){
        return res.status(400).json({message: "Invalid Credentials"})
    }

    const accessToken = jwt.sign({userId: user._id}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '72h'});
    return res.json({
        error: false,
        message: "Login Successful",
        user: {fullName: user.fullName, email: user.email},
        accessToken,
    })
})

// Get User
app.get('/get-user', authenticateToken, async(req, res) => {
    const {userId} = req.user
    const isUser = await User.findOne({_id: userId})

    if(!isUser){
        return res.sendStatus(401);
    }

    return res.json({
        user: isUser,
        message: "",
    })
})


// Handle image uploads
app.post("/image-upload", upload.single("image"), async(req, res) => {
    try{
        if(!req.file){
            return res.status(400).json({error: true, message: "No images uploaded"})
        }
        const imageUrl = `${process.env.SERVER_URL}/uploads/${req.file.filename}`;

        res.status(201).json({imageUrl});
    } catch(error){
        res.status(500).json({error: true, message: error.message});
    }
})


//Delete an uploaded image
app.delete("/delete-image", async(req, res) => {
    const { imageUrl } = req.query;
    if(!imageUrl){
        return res.status(400).json({error: true, message: "imageUrl parameter is required"});
    }

    try{
        const filename = path.basename(imageUrl);
        const filePath = path.join(__dirname, 'uploads', filename);
        if(fs.existsSync(filePath)){
            fs.unlinkSync(filePath);
            res.status(200).json({message: "image deleted"})
        }
        else{
            res.status(200).json({error: true, message: "Image not found"})
        }
    } catch(error) {
        res.status(500).json({error: true, message: error.message});
    }
})



// Add Travel Stroy
app.post("/add-travel-story", authenticateToken, async(req, res) => {
    let { title, story, visitedLocation, imageUrl, visitedDate } = req.body;
    const { userId } = req.user

    if(!imageUrl){
        imageUrl = "https://coffective.com/wp-content/uploads/2018/06/default-featured-image.png.jpg"
    }

    // Check if all fields are there
    if(!title || !story || !visitedLocation || !imageUrl || !visitedDate){
        return res.status(400).json({error: true, message: "All fields are required"});
    }

    // Date conversion
    const parsedVisitedDate = new Date(parseInt(visitedDate));
    try{
        const travelStory = new TravelStory({
            title,
            story,
            visitedLocation,
            userId,
            imageUrl,
            visitedDate: parsedVisitedDate,
        });

        await travelStory.save();
        res.status(201).json({story: travelStory, message: "Success"});
    } catch(error){
        res.status(400).json({error: true, message: error.message});
    }
})


// Get all travel story
app.get('/get-all-stories', authenticateToken, async(req, res) => {
    const { userId } = req.user;

    try{
        const travelStories = await TravelStory.find({userId: userId}).sort({isFavourite: -1});
        // const travelStories = await TravelStory.find({}).sort({isFavourite: -1});
        res.status(200).json({stories: travelStories});
    } catch(error){
        res.status(400).json({error: true, message: error.message})
    }
})


// Edit Travel Story
app.put("/edit-story/:id", authenticateToken, async(req, res) => {
    const {id} = req.params;
    const {title, story, visitedLocation, imageUrl, visitedDate} = req.body;
    const {userId} = req.user;

    // Check if all fields are there
    if(!title || !story || !visitedLocation || !imageUrl || !visitedDate){
        return res.status(400).json({error: true, message: "All fields are required"});
    }

    // Date Conversion
    const parsedVisitedDate = new Date(parseInt(visitedDate));

    try{
        const travelStory = await TravelStory.findOne({_id: id, userId: userId});

        if(!travelStory){
            return res.status(404).json({error: true, message: "Travel Story not found"});
        }

        const placeholderImgUrl = `${process.env.SERVER_URL}/assets/placeholder.jpg`
        
        travelStory.title = title;
        travelStory.story = story;
        travelStory.visitedLocation = visitedLocation;
        travelStory.imageUrl = imageUrl || placeholderImgUrl;
        travelStory.visitedDate = visitedDate;

        await travelStory.save();
        res.status(200).json({story: travelStory, message: "updated successful"});
    } catch(error){
        return res.status(400).json({error: true, message: error.message})
    }

})

// Delete Travel Story
app.delete("/delete-story/:id", authenticateToken, async(req, res) => {
    const {id} = req.params;
    const {userId} = req.user;

    try{
        const travelStory = await TravelStory.findOne({_id: id, userId: userId});

        if(!travelStory){
            return res.status(404).json({error: true, message: "Travel Story not found"});
        }

        await travelStory.deleteOne({_id: id, userId: userId});

        // delete image
        // const imageUrl = travelStory.imageUrl;
        // const filename = path.basename(imageUrl);
        // const filePath = path.join(__dirname, 'uploads', filename);

        // fs.unlink(filePath, (err) => {
        //     if(err){
        //         return res.status(200).json({message: "Story Deleted"})
        //     }
        // })
        // res.status(200).json({message: "Story Deleted"})

    } catch(error){
        return res.status(400).json({error: true, message: error.message});
    }
})


// update isFavourite
app.put("/update-is-favourite/:id", authenticateToken, async(req, res) => {
    const {id} = req.params;
    const {isFavourite} = req.body;
    const {userId} = req.user;

    try{
        const travelStory = await TravelStory.findOne({_id: id, userId: userId});
        if(!travelStory){
            return res.status(404).json({error: true, message: "story not found"});
        }

        travelStory.isFavourite = isFavourite;
        await travelStory.save();
        res.status(200).json({story: travelStory, message: "upate sucessful"})
    } catch(error){
        return res.status(400).json({error: true, message: error.message});
    }
})

// search story
app.get("/search", authenticateToken, async(req, res) => {
    const { query } = req.query;
    const {userId} = req.user;

    if(!query){
        return res.status(400).json({error: true, message: "query is requierd"})
    }

    try{
        const searchResults = await TravelStory.find({
            userId: userId,
            title: {$regex: query, $options: "i"}
        }).sort({isFavourite: -1});
        res.status(200).json({stories: searchResults});
    } catch(error){
        return res.status(400).json({error: true, message: error.message});
    }
})

app.listen(port);
module.exports = app;