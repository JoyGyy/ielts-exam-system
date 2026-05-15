(function registerListeningExamData(global) {
  'use strict';
  if (!global.__LISTENING_EXAM_DATA__ || typeof global.__LISTENING_EXAM_DATA__.register !== "function") {
    throw new Error("listening_exam_registry_missing");
  }
  global.__LISTENING_EXAM_DATA__.register("listening-p3-high-09", {
    "schemaVersion": "ListeningExamSourceV1",
    "examId": "listening-p3-high-09",
    "meta": {
      "title": "Research on Work Absence",
      "category": "P3",
      "frequency": "high",
      "audioSrc": "../../listening/audio/listening-p3-high-09.mp3",
      "localStorageKey": "ieltsListening_work_absence_v1"
},
    "questionList": ["21","22","23","24","25-26","27-28","29-30"],
    "questions": {
    "q21": {
        "number": "21",
        "kind": "single-choice"
    },
    "q22": {
        "number": "22",
        "kind": "single-choice"
    },
    "q23": {
        "number": "23",
        "kind": "single-choice"
    },
    "q24": {
        "number": "24",
        "kind": "single-choice"
    },
    "q25-26": {
        "number": "25-26",
        "kind": "fill-in-blank"
    },
    "q27-28": {
        "number": "27-28",
        "kind": "fill-in-blank"
    },
    "q29-30": {
        "number": "29-30",
        "kind": "fill-in-blank"
    }
},
    "answerKey": {
    "single": {
        "q21": "A",
        "q22": "B",
        "q23": "A",
        "q24": "B"
    },
    "multiple": {
        "q25_26": [
            "C",
            "E"
        ],
        "q27_28": [
            "C",
            "D"
        ],
        "q29_30": [
            "A",
            "D"
        ]
    }
},
    "transcriptLines": [["00:00","00:12","You will hear a business student called Laura talking to her tutor about some research she is planning to do on employee absence."],["00:17","00:21","First you have some time to look at questions 21 to 24."],["00:30","00:56","Now listen carefully and answer questions 21 to 24."],["00:57","01:04","Hello Laura have a seat. So I understand your planning to investigate absence from work"],["01:04","01:10","for your research project. That's right I'm going to base it on a local company called"],["01:10","01:16","Birkock Engineering. Is there any particular reason why you've chosen Birkock?"],["01:16","01:22","Well I'd originally thought of asking another company FG Engineering because I did my placement"],["01:22","01:30","there and I knew the staff there but the CEO wasn't very keen but she knows the managing director"],["01:30","01:36","at Birkock and she spoke to him and then he got in touch with me. Apparently absence is a major"],["01:36","01:44","problem there so he's quite interested in having it investigated. So my central theme is absence"],["01:44","01:51","but I'm thinking of concentrating on long term absence. I thought that might allow me to give"],["01:51","01:56","more helpful feedback to the company. If I were you I wouldn't be that specific I'd look at"],["01:56","02:02","absence as a whole you might get more interesting results. Oh okay. So what's the main thing you"],["02:02","02:10","expect to find? Rise is in absence rates over time? Not really. Initially I wondered if workers"],["02:10","02:16","often take time off without real justification but I think that'll be hard to determine."],["02:16","02:22","So well I think I may find that it's something to do with what sort of job the employee is"],["02:22","02:30","doing. Okay now have you thought how you'll get your information? Well first of all I need access"],["02:30","02:37","to the company records. Yes obviously you'll need overall absence figures though it's unlikely"],["02:37","02:42","they'll let you have them for individual workers and you probably won't have access to personal"],["02:42","02:48","information like when they were born but you should be able to use anonymous details like the type"],["02:48","02:58","of work they do or how long they've been with the company. Okay. Before you hear the rest of the"],["02:58","03:02","discussion you have some time to look at questions 25 to 30."],["03:12","03:36","Now listen and answer questions 25 to 30."],["03:36","03:46","So let's think a bit more about your questionnaire. I know that it shouldn't be too long or people get"],["03:46","03:52","bored. No but if it's too short you don't get enough information. The trick is to get the balance"],["03:52","03:58","right. I think the questions should be closed questions too. I mean where people choose an answer"],["03:58","04:05","from a list. But then you miss the chance of getting unexpected information so I'd include one or"],["04:05","04:11","two open-ended questions too. Okay and I won't ask for names or addresses or anything."],["04:12","04:17","No it needs to be anonymous and after you've drafted it you need to give it to at least one"],["04:17","04:23","person to check there aren't any problems so you need to leave enough time for that and any"],["04:23","04:28","revisions necessary. What about the covering letter that I'll send out with the questionnaire?"],["04:28","04:34","I'll need to introduce myself and explain what the questionnaire is for but what else should I"],["04:34","04:40","include? I'd reassure people that the survey isn't going to be used to assess them personally"],["04:40","04:47","otherwise they might choose not to take part. Yes I'll make that clear. And what about when they do"],["04:47","04:53","it? Will they be allowed to use work time? That's really up to their manager but you should say"],["04:53","05:00","roughly how much time it'll take. Okay. So now you need to produce a schedule with dates. For"],["05:00","05:06","example when you'll send out the questionnaire. Yes okay. Once I can arrange that date with the"],["05:06","05:10","manager I'll be able to fix the deadline for getting the completed questionnaires back."],["05:11","05:17","And I want to use the time in between to analyse the figures that HR is going to give me from their"],["05:17","05:23","database though they haven't said exactly when I'll get them. And you have to submit your assignment"],["05:23","05:28","by the end of June. Actually I have to get it finished by the second because I've arranged a"],["05:28","05:36","work placement after that. Okay. So our next meeting is two weeks today. Is that still okay?"],["05:36","05:39","Yes and in the meantime I'll send you an email."],["05:42","05:48","That is the end of part three. You now have 30 seconds to check your answers to part three."]],
    "questionsPageHtml": "<div data-section=\"1\">\n <div class=\"group\">\n <h4>Questions 21-24</h4>\n <p class=\"instructions\">Choose the correct letter, <b>A</b>, <b>B</b> or <b>C</b>.</p>\n <p><b>21</b> Laura chose Burdock Engineering for her research because</p>\n <label><input type=\"radio\" name=\"q21\" data-q=\"21\" value=\"A\"><b>A</b> she was contacted by the managing director.</label>\n <label><input type=\"radio\" name=\"q21\" data-q=\"21\" value=\"B\"><b>B</b> she knew several people who worked there.</label>\n <label><input type=\"radio\" name=\"q21\" data-q=\"21\" value=\"C\"><b>C</b> she had already done a work placement there.</label>\n \n <p><b>22</b> What does Laura agree to do regarding the central theme of her research?</p>\n <label><input type=\"radio\" name=\"q22\" data-q=\"22\" value=\"A\"><b>A</b> check it is relevant</label>\n <label><input type=\"radio\" name=\"q22\" data-q=\"22\" value=\"B\"><b>B</b> broaden the focus</label>\n <label><input type=\"radio\" name=\"q22\" data-q=\"22\" value=\"C\"><b>C</b> be more specific in her aims</label>\n \n <p><b>23</b> What does Laura expect to find from her research?</p>\n <label><input type=\"radio\" name=\"q23\" data-q=\"23\" value=\"A\"><b>A</b> Absence rates are related to the type of work done.</label>\n <label><input type=\"radio\" name=\"q23\" data-q=\"23\" value=\"B\"><b>B</b> A lot of worker absence is actually unnecessary.</label>\n <label><input type=\"radio\" name=\"q23\" data-q=\"23\" value=\"C\"><b>C</b> Employee absence rates are increasing.</label>\n \n <p><b>24</b> What employee information does the tutor think Laura will be able to obtain from company records?</p>\n <label><input type=\"radio\" name=\"q24\" data-q=\"24\" value=\"A\"><b>A</b> dates of birth</label>\n <label><input type=\"radio\" name=\"q24\" data-q=\"24\" value=\"B\"><b>B</b> details of employment</label>\n <label><input type=\"radio\" name=\"q24\" data-q=\"24\" value=\"C\"><b>C</b> individual records of absence</label>\n </div>\n </div>\n\n <div data-section=\"2\">\n <div class=\"group\" data-limit=\"2\" data-q=\"25-26\">\n <h4>Questions 25 and 26</h4>\n <p class=\"instructions\">Choose <b>TWO</b> letters, <b>A–E</b>.</p>\n <p><b>25-26</b> Which TWO recommendations does the tutor make about Laura's questionnaire?</p>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"A\"><b>A</b> Leave a space for contact details.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"B\"><b>B</b> Specify a completion date.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"C\"><b>C</b> Provide a mixture of question types.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"D\"><b>D</b> Keep the length to a minimum.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"E\"><b>E</b> Trial it on someone before finalising it.</label>\n </div>\n \n <div class=\"group\" data-limit=\"2\" data-q=\"27-28\">\n <h4>Questions 27 and 28</h4>\n <p class=\"instructions\">Choose <b>TWO</b> letters, <b>A–E</b>.</p>\n <p><b>27-28</b> Which TWO things will Laura explain in her covering letter to participants?</p>\n <label><input type=\"checkbox\" name=\"q27_28\" value=\"A\"><b>A</b> when the questionnaire should be completed</label>\n <label><input type=\"checkbox\" name=\"q27_28\" value=\"B\"><b>B</b> the fact that participation in the survey is voluntary</label>\n <label><input type=\"checkbox\" name=\"q27_28\" value=\"C\"><b>C</b> how long the questionnaire is likely to take</label>\n <label><input type=\"checkbox\" name=\"q27_28\" value=\"D\"><b>D</b> the purpose of the survey</label>\n <label><input type=\"checkbox\" name=\"q27_28\" value=\"E\"><b>E</b> the benefits of participation in the survey</label>\n </div>\n \n <div class=\"group\" data-limit=\"2\" data-q=\"29-30\">\n <h4>Questions 29 and 30</h4>\n <p class=\"instructions\">Choose <b>TWO</b> letters, <b>A–E</b>.</p>\n <p><b>29-30</b> Which TWO activities does Laura already have definite dates for?</p>\n <label><input type=\"checkbox\" name=\"q29_30\" value=\"A\"><b>A</b> completion of her finished assignment</label>\n <label><input type=\"checkbox\" name=\"q29_30\" value=\"B\"><b>B</b> questionnaire distribution</label>\n <label><input type=\"checkbox\" name=\"q29_30\" value=\"C\"><b>C</b> collection of completed questionnaires</label>\n <label><input type=\"checkbox\" name=\"q29_30\" value=\"D\"><b>D</b> the next meeting with her tutor</label>\n <label><input type=\"checkbox\" name=\"q29_30\" value=\"E\"><b>E</b> analysis of figures from the company's database</label>\n </div>\n </div>\n <div class=\"results-in-page\"></div>"
  });
})(typeof window !== 'undefined' ? window : globalThis);
