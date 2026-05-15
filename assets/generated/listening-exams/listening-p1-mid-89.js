(function registerListeningExamData(global) {
  'use strict';
  if (!global.__LISTENING_EXAM_DATA__ || typeof global.__LISTENING_EXAM_DATA__.register !== "function") {
    throw new Error("listening_exam_registry_missing");
  }
  global.__LISTENING_EXAM_DATA__.register("listening-p1-mid-89", {
    "schemaVersion": "ListeningExamSourceV1",
    "examId": "listening-p1-mid-89",
    "meta": {
      "title": "Working in a summer camp in the USA",
      "category": "P1",
      "frequency": "mid",
      "audioSrc": "/assets/listening/audio/listening-p1-mid-89.mp3",
      "localStorageKey": "ielts_summercamp_p1"
},
    "questionList": ["1","2","3","4","5","6","7","8","9","10"],
    "questions": {
    "q1": {
        "number": "1",
        "kind": "fill-in-blank"
    },
    "q2": {
        "number": "2",
        "kind": "fill-in-blank"
    },
    "q3": {
        "number": "3",
        "kind": "fill-in-blank"
    },
    "q4": {
        "number": "4",
        "kind": "fill-in-blank"
    },
    "q5": {
        "number": "5",
        "kind": "fill-in-blank"
    },
    "q6": {
        "number": "6",
        "kind": "fill-in-blank"
    },
    "q7": {
        "number": "7",
        "kind": "fill-in-blank"
    },
    "q8": {
        "number": "8",
        "kind": "fill-in-blank"
    },
    "q9": {
        "number": "9",
        "kind": "fill-in-blank"
    },
    "q10": {
        "number": "10",
        "kind": "fill-in-blank"
    }
},
    "answerKey": {
    "text": {
        "q1": "Leader",
        "q2": "Tennis",
        "q3": "8",
        "q4": "June",
        "q5": "Training",
        "q6": "19",
        "q7": "985",
        "q8": "Insurance",
        "q9": "Police",
        "q10": "Discount"
    }
},
    "transcriptLines": [],
    "questionsPageHtml": "<div class=\"group\">\n <h4>Questions 1-10</h4>\n <p class=\"instructions\">Write <b>ONE WORD AND/OR A NUMBER</b> for each answer.</p>\n <p>Job involves being with children for 24 hours per day</p>\n <p>General counsellors need experience of working with children as a <b>1</b><input type=\"text\" name=\"q1\" class=\"blank\" autocomplete=\"off\"></p>\n <p>Specialist counsellors could use skills in: - Sports, e.g. <b>2</b><input type=\"text\" name=\"q2\" class=\"blank\" autocomplete=\"off\"> - Art</p>\n <p>Job in summer camp lasts for <b>3</b><input type=\"text\" name=\"q3\" class=\"blank\" autocomplete=\"off\"> weeks with the chance to travel afterwards</p>\n <p>Job starts in <b>4</b><input type=\"text\" name=\"q4\" class=\"blank\" autocomplete=\"off\"></p>\n <p>First week of job is used for <b>5</b><input type=\"text\" name=\"q5\" class=\"blank\" autocomplete=\"off\"></p>\n <p>Officially, counsellors must be at least <b>6</b><input type=\"text\" name=\"q6\" class=\"blank\" autocomplete=\"off\"> years old</p>\n <p>Salary: <b>7</b><input type=\"text\" name=\"q7\" class=\"blank\" autocomplete=\"off\"> US \\$</p>\n <p>Must pay for: - Own <b>8</b><input type=\"text\" name=\"q8\" class=\"blank\" autocomplete=\"off\"> (£138) - A <b>9</b><input type=\"text\" name=\"q9\" class=\"blank\" autocomplete=\"off\"> check in UK (£36)</p>\n <p>Can get a <b>10</b><input type=\"text\" name=\"q10\" class=\"blank\" autocomplete=\"off\"> on travel in America after camp</p>\n </div>\n <div class=\"results-in-page\"></div>"
  });
})(typeof window !== 'undefined' ? window : globalThis);
