const multer = require("multer")
const path = require("path")


// Storage Conf
const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, "./uploads/");
    },
    filename: function(req, file, cb){
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Accept only images
const fileFilter = (req, file, cb) => {
    if(file.mimetype.startsWith("image/")){
        cb(null, true);
    }else{
        cb(new Error("Only Images are allowed"), false);
    }
}

// Initialize
const upload = multer({storage, fileFilter});
module.exports = upload;