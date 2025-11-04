const express = require('express');
const multer = require('multer');
const app = express();

// Import function-based student controller
const studentController = require('./controllers/StudentController');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Set up view engine and middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// Routes using controller methods
app.get('/', studentController.listStudents); // list all students (renders index)

app.get('/student/:id', studentController.getStudentById); // view a single student (renders student)

app.get('/addStudent', (req, res) => res.render('addStudent')); // show add form

app.post('/addStudent', upload.single('image'), studentController.addStudent); // handle add (multipart)

app.get('/editStudent/:id', studentController.getStudentById); // controller should render edit view when appropriate

app.post('/editStudent/:id', upload.single('image'), studentController.updateStudent); // handle update (multipart)

app.get('/deleteStudent/:id', studentController.deleteStudent); // handle delete (redirects as appropriate)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
