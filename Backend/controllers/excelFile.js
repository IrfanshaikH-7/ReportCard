const xlsx = require('xlsx');
const mongoose = require('mongoose');
const Student = require('../models/student');
const Class = require('../models/excelmodel');
const math = require('mathjs');
const simpleStatistics = require('simple-statistics');
exports.uploadFile = async (req, res) => {
  const file = req.file;
  const workbook = await xlsx.readFile(file.path);
  const sheetNames = workbook.SheetNames;

  // Get sheets at index 0 and 2
  const sheet1 = workbook.Sheets[sheetNames[0]];
  const sheet2 = workbook.Sheets[sheetNames[2]];
  
  const data = xlsx.utils.sheet_to_json(sheet1);

  const dataSheet2 = xlsx.utils.sheet_to_json(sheet2, { header: 1 });




 const discIndexColumnIndex = dataSheet2[4].indexOf('Disc. Index');
 const discIndexData = dataSheet2.slice(5)
 .map(row => row[discIndexColumnIndex])
 .filter(value => value !== null && value !== undefined);


//  console.log("🚀 ~ exports.uploadFile= ~ Disc Index data:", discIndexData);

//  return res.status(200).json({
//    message: "Data extracted successfully",
//    discIndexData: discIndexData
//  });



  

  // console.log("🚀 ~ exports.uploadFile= ~ data:", data.slice(2));
  const extractQuestionColumns = (row) => {
    const questionColumns = [];
    Object.keys(row).forEach((key) => {
      if (/^Q\s*\d+$/.test(key)) {
        questionColumns.push({ question: key.replace(/\s/g, ''), answer: row[key] }); // Remove spaces from keys
      }
    });
    return questionColumns;
  };
  // Extract answer key from the first row
  const answerKeyData = data.slice(0, 1)[0];
  const answerKey = extractQuestionColumns(answerKeyData);
  console.log("🚀 ~ exports.uploadFile= ~ answerKey:", answerKey);

  // Function to dynamically extract columns that match a pattern
  

  // Function to parse percentage strings to numbers
  const parsePercentage = (percentage) => {
    if (typeof percentage === 'string') {
      return parseFloat(percentage.replace('%', ''));
    }
    return percentage;
  };

  // Function to calculate score based on the answer key
  const calculateScore = (studentAnswers, answerKey) => {
    let score = 0;
    studentAnswers.forEach((answer) => {
      const correctAnswer = answerKey.find((key) => key.question === answer.question);
      if (correctAnswer && correctAnswer.answer === answer.answer) {
        score += 1; // Increment score for each correct answer
      }
    });
    return score;
  };

  // Map student data and calculate scores
  const studentsData = data.slice(1).map((row) => {
    const studentAnswers = extractQuestionColumns(row);
    const score = calculateScore(studentAnswers, answerKey);
    return {
      name: row.StudentName,
      idNumber: row.IDNumber,
      blankCount: row.BlankCount ? parseInt(row.BlankCount, 10) : 0,
      correctCount: score,
      percentage: row.Percentage ? parsePercentage(row.Percentage) : 0,
      score: score,
      questions: studentAnswers
    };
  });

  // Create a new class with the answer key
  const newClass = new Class({
    className: 'Class 1', // You can set this dynamically
    answerKey: answerKey
  });

  try {
    // Save the class to get the class ID
    const savedClass = await newClass.save();

    // Save students and get their IDs
    const savedStudents = await Student.insertMany(studentsData);

    // Update the class with the student IDs
    savedClass.students = savedStudents.map(student => student._id);
    await savedClass.save();





    // Calculation
  









    console.log('Class and students saved successfully');
    res.status(200).json({ message: "File uploaded successfully", data: savedStudents });
  } catch (error) {
    console.error('Error saving class and students:', error);
    res.status(500).json({ message: "Error saving data", error });
  }
};

exports.calculateResult = async (req, res) => {
  try {
    const classData = await Class.findById({ _id: "66c998b41052ee69590f4a7b" }).populate("students");
    const answerKeys = classData.answerKey; // Extract answer keys from the class data

    const QA_P = {};
    const QA_Q = {};
    const QA_PQ = {};
    let QA_PQ_Sum = 0;

    for (const answerKey of answerKeys) {
      const accuracies = [];

      for (const student of classData.students) {
        const studentAnswer = student.questions.find(q => q.question === answerKey.question);

        if (studentAnswer) {
          const isCorrect = studentAnswer.answer === answerKey.answer;
          accuracies.push(isCorrect ? 1 : 0);

          if (answerKey.question === "Q5") {
            console.log("Student Key:", student._id);
            console.log("Student Answer:", studentAnswer.answer);
          }
        }
      }

      const totalStudents = classData.students.length;
      const questionAccuracyValue = accuracies.reduce((sum, accuracy) => sum + accuracy, 0) / totalStudents;

      const roundedAccuracy = questionAccuracyValue.toFixed(2);

      QA_P[answerKey.question] = roundedAccuracy;
      QA_Q[answerKey.question] = (1 - questionAccuracyValue).toFixed(2);
      QA_PQ[answerKey.question] = (roundedAccuracy * (1 - questionAccuracyValue)).toFixed(2);

      QA_PQ_Sum += parseFloat(QA_PQ[answerKey.question]);
    }

    const studentScores = {
      stud_1: 45.00,
      stud_2: 48.00,
      stud_3: 44.00,
      stud_4: 48.00,
      stud_5: 47.00,
      stud_6: 46.00,
      stud_7: 46.00,
      stud_8: 46.00,
      stud_9: 44.00,
      stud_10: 46.00,
      stud_11: 47.00,
      stud_12: 45.00,
      stud_13: 42.00,
      stud_14: 44.00,
      stud_15: 31.00,
      stud_16: 43.00,
      stud_17: 40.00,
      stud_18: 43.00
    };

   
    function calculateSingleValue(scores) {
      // Convert the object values to an array
      const scoreArray = Object.values(scores);

      // Calculate the population variance using simple-statistics
      const variance = simpleStatistics.variance(scoreArray, { sample: false });

      return variance;
    }

    const variance = calculateSingleValue(studentScores);
    // =(C27/(C27-1))*(1-(C28/C29))


    const KR20 = (answerKeys?.length / (answerKeys?.length - 1) * ( 1 - (QA_PQ_Sum.toFixed(2) / variance.toFixed(2) )))
    res.json({
      KR20,
      answerKeys: answerKeys?.length,
      QA_P,
      QA_Q,
      QA_PQ,
      QA_PQ_Sum: QA_PQ_Sum.toFixed(2),
      variance: variance.toFixed(2),
    });
  } catch (error) {
    console.log(error.message);
  }
};