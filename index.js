const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const cors = require('cors');
const FormData = require('form-data');
const env = require("dotenv");

const app = express();
const port = 3000;

env.config();

app.use(express.static("public"));

app.use(cors());
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads')
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname)
    }
  })

const upload = multer({ storage: storage });

app.get("/", (req, res) =>{
    res.render("index.ejs");
})




app.post("/api/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    const passMarks = parseInt(req.body.passingMarks);
    const serviceType = req.body.serviceType;
    console.log("passing marks:"+passMarks)
    if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        let data = new FormData();
        data.append('apikey', process.env.APIKEY);
        data.append('file', fs.createReadStream(file.path));
        data.append('OCREngine', '2');
        data.append('isTable', 'True');

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://api.ocr.space/parse/image',
            headers: {
                ...data.getHeaders()
            },
            data: data
        };

        axios.request(config)
            .then((response) => {
                console.log("response recieved");
                const extractedText = response.data.ParsedResults[0].ParsedText;
                const result = arrangeTable(extractedText, passMarks);
                console.log(result);
                //res.json(result);
                if(serviceType == "failed") res.render("failed.ejs", {failedStudents: result.failedStudents})
                else res.render("failed.ejs", {failedStudents: result.tableData})
            })
            .catch((error) => {
                console.log(error);
            });


    } catch (error) {
        console.error("Error processing the file:", error);
        res.status(500).json({ error: "Failed to process the file" });
    }
})

app.listen(port, () => console.log(`Server running on port ${port}`));




function arrangeTable(tableText, passingMarks) {
    // Split the text into lines
    const lines = tableText.split('\r\n');
  
    // Create arrays to store the table data and failed students
    const tableData = [];
    const failedStudents = [];
  
    // Iterate through each line
    for (let i = 1; i < lines.length; i++) {  // Start from 1 to skip the header
      // Split the line into columns based on tabs
      const columns = lines[i].split('\t');
  
      // Ignore lines that do not have the expected number of columns
      if (columns.length < 4) continue;
  
      // Trim and extract marks
      const marks = columns[3];
  
      // Check if marks are a valid number
      const marksAsNumber = parseInt(marks);
  
      // Skip rows where marks are not a valid number
      if (isNaN(marksAsNumber)) continue;
  
      // Create a new row object
      const row = {
        'SNo.': columns[0],
        'Enrollment No.': columns[1],
        'Name': columns[2],
        'Marks': marksAsNumber,
      };
  
      // Add the row to the table data array
      tableData.push(row);
      // Check if the student has failed (marks below passing threshold)
      if (marksAsNumber < passingMarks) {
        failedStudents.push(row);
      }
    }
  
    // Return the arranged table data and failed students list
    return {
      tableData,failedStudents
    };
  }
