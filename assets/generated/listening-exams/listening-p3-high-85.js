(function registerListeningExamData(global) {
  'use strict';
  if (!global.__LISTENING_EXAM_DATA__ || typeof global.__LISTENING_EXAM_DATA__.register !== "function") {
    throw new Error("listening_exam_registry_missing");
  }
  global.__LISTENING_EXAM_DATA__.register("listening-p3-high-85", {
    "schemaVersion": "ListeningExamSourceV1",
    "examId": "listening-p3-high-85",
    "meta": {
      "title": "Outdoor Activities",
      "category": "P3",
      "frequency": "high",
      "audioSrc": "../../assets/listening/audio/listening-p3-high-85.mp3",
      "localStorageKey": "ielts_outdoor_85"
},
    "questionList": ["21-22","23-24","25-26","27","28","29","30"],
    "questions": {
    "q21-22": {
        "number": "21-22",
        "kind": "fill-in-blank"
    },
    "q23-24": {
        "number": "23-24",
        "kind": "fill-in-blank"
    },
    "q25-26": {
        "number": "25-26",
        "kind": "fill-in-blank"
    },
    "q27": {
        "number": "27",
        "kind": "single-choice"
    },
    "q28": {
        "number": "28",
        "kind": "single-choice"
    },
    "q29": {
        "number": "29",
        "kind": "single-choice"
    },
    "q30": {
        "number": "30",
        "kind": "single-choice"
    }
},
    "answerKey": {
    "text": {},
    "single": {
        "q27": "B",
        "q28": "A",
        "q29": "A",
        "q30": "C"
    },
    "multiple": {
        "q21_22": [
            "A",
            "E"
        ],
        "q23_24": [
            "A",
            "D"
        ],
        "q25_26": [
            "C",
            "D"
        ]
    },
    "matching": {}
},
    "transcriptLines": [["00:00","03:00","Ravi: ...I've been reading about why children spend less time playing outside now than 20 or 30 years ago."],["03:01","03:10","Tutor: So is it just because of online time?"],["03:11","03:25","Ravi: There's perhaps no more important factor than <span class='answer-highlight'>parental worries about traffic (Q21 A)</span>. Also children are in structured activities, reducing <span class='answer-highlight'>free time outdoors (Q22 E)</span>."],["03:26","03:40","Tutor: What do you want to focus on in your assignment?"],["03:41","04:10","Ravi: I'd like to investigate unexpected benefits like <span class='answer-highlight'>how it helps children evaluate risk (Q23 A)</span> and also <span class='answer-highlight'>improves digestion (Q24 D)</span> – fresh air stimulates hunger."],["04:11","04:40","Ravi: Surveys show play sessions now don't last as long (<span class='answer-highlight'>shorter time Q25 C</span>), and there are fewer <span class='answer-highlight'>made-up games (Q26 D</span>). Chasing games are still popular."],["04:41","05:10","Ravi: Parents should worry because inactivity links to <span class='answer-highlight'>health problems later in life (Q27 B)</span>."],["05:11","05:30","Ravi: Schools should <span class='answer-highlight'>revise their aims (Q28 A)</span> – develop confidence, not just exam results."],["05:31","05:50","Tutor: Smith & Barker found rural children are generally told to <span class='answer-highlight'>keep off farmland (Q29 A)</span>."],["05:51","06:20","Dr Chang: Their research focus was <span class='answer-highlight'>limited to rural areas (Q30 C)</span>, so be careful applying findings."],["06:21","06:50","&nbsp;"]],
    "questionsPageHtml": "<div data-section=\"3\">\n \n <div class=\"group\" data-limit=\"2\" data-q=\"21-22\">\n <h4>Questions 21-22</h4>\n <p class=\"instructions\">Choose <b>TWO</b> letters, A–E.</p>\n <p><b>21-22</b> What do the speakers agree are the two reasons why children play outdoors less now than in the past?</p>\n <label><input type=\"checkbox\" name=\"q21_22\" value=\"A\"><b>A</b> Concerns about traffic</label>\n <label><input type=\"checkbox\" name=\"q21_22\" value=\"B\"><b>B</b> Limited outdoor play facilities</label>\n <label><input type=\"checkbox\" name=\"q21_22\" value=\"C\"><b>C</b> Increased time spent online</label>\n <label><input type=\"checkbox\" name=\"q21_22\" value=\"D\"><b>D</b> Preference for indoor play</label>\n <label><input type=\"checkbox\" name=\"q21_22\" value=\"E\"><b>E</b> Reduction in free time</label>\n </div>\n \n <div class=\"group\" data-limit=\"2\" data-q=\"23-24\">\n <h4>Questions 23-24</h4>\n <p class=\"instructions\">Choose <b>TWO</b> letters, A–E.</p>\n <p><b>23-24</b> In his assignment, which two aspects of outdoor play does Ravi want to focus on?</p>\n <label><input type=\"checkbox\" name=\"q23_24\" value=\"A\"><b>A</b> How it helps children to evaluate risk</label>\n <label><input type=\"checkbox\" name=\"q23_24\" value=\"B\"><b>B</b> How it broadens their horizons</label>\n <label><input type=\"checkbox\" name=\"q23_24\" value=\"C\"><b>C</b> How it aids children's muscular development</label>\n <label><input type=\"checkbox\" name=\"q23_24\" value=\"D\"><b>D</b> How it improves children's digestion</label>\n <label><input type=\"checkbox\" name=\"q23_24\" value=\"E\"><b>E</b> How it teaches children about the environment</label>\n </div>\n \n <div class=\"group\" data-limit=\"2\" data-q=\"25-26\">\n <h4>Questions 25-26</h4>\n <p class=\"instructions\">Choose <b>TWO</b> letters, A–E.</p>\n <p><b>25-26</b> According to Ravi, in which two ways are children's periods of outdoor play now different from a generation ago?</p>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"A\"><b>A</b> They are less dangerous.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"B\"><b>B</b> They involve fewer children.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"C\"><b>C</b> They usually last a shorter time.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"D\"><b>D</b> They include fewer made-up games.</label>\n <label><input type=\"checkbox\" name=\"q25_26\" value=\"E\"><b>E</b> They involve fewer chasing games.</label>\n </div>\n \n <div class=\"group\">\n <h4>Questions 27-30</h4>\n <p class=\"instructions\">Choose the correct letter, A, B or C.</p>\n <p><b>27</b> Ravi thinks parents should be more concerned about the decline of outdoor play because</p>\n <label><input type=\"radio\" name=\"q27\" value=\"A\"><b>A</b> It affects family relationships.</label>\n <label><input type=\"radio\" name=\"q27\" value=\"B\"><b>B</b> It leads to health problems later in life.</label>\n <label><input type=\"radio\" name=\"q27\" value=\"C\"><b>C</b> It makes childhood less enjoyable.</label>\n\n <p><b>28</b> What does Ravi say that schools should do with regard to outdoor play?</p>\n <label><input type=\"radio\" name=\"q28\" value=\"A\"><b>A</b> Revise their aims.</label>\n <label><input type=\"radio\" name=\"q28\" value=\"B\"><b>B</b> Spend more money on it.</label>\n <label><input type=\"radio\" name=\"q28\" value=\"C\"><b>C</b> Listen to the views of parents.</label>\n\n <p><b>29</b> What did Smith and Barker say about children in rural areas?</p>\n <label><input type=\"radio\" name=\"q29\" value=\"A\"><b>A</b> They tend not to be allowed on farmland.</label>\n <label><input type=\"radio\" name=\"q29\" value=\"B\"><b>B</b> They receive more supervision outdoors.</label>\n <label><input type=\"radio\" name=\"q29\" value=\"C\"><b>C</b> They spend more time outdoors than city children.</label>\n\n <p><b>30</b> What problem does Dr Chang highlight about Smith and Barker's research?</p>\n <label><input type=\"radio\" name=\"q30\" value=\"A\"><b>A</b> Its findings are inconclusive.</label>\n <label><input type=\"radio\" name=\"q30\" value=\"B\"><b>B</b> It is too old to be useful.</label>\n <label><input type=\"radio\" name=\"q30\" value=\"C\"><b>C</b> Its focus is limited.</label>\n </div>\n </div>\n <div class=\"results-in-page\"></div>"
  });
})(typeof window !== 'undefined' ? window : globalThis);
