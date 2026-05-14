(function registerListeningExamData(global) {
  'use strict';
  if (!global.__LISTENING_EXAM_DATA__ || typeof global.__LISTENING_EXAM_DATA__.register !== "function") {
    throw new Error("listening_exam_registry_missing");
  }
  global.__LISTENING_EXAM_DATA__.register("listening-p2-high-10", {
    "schemaVersion": "ListeningExamSourceV1",
    "examId": "listening-p2-high-10",
    "meta": {
      "title": "Driving License",
      "category": "P2",
      "frequency": "high",
      "audioSrc": "assets/listening/listening-p2-high-10.mp3",
      "localStorageKey": "ieltsListening_drivingLicense_v1"
},
    "questionList": ["11","12","13","14","15","16","17","18","19","20"],
    "questions": {
    "q11": {
        "number": "11",
        "kind": "single-choice"
    },
    "q12": {
        "number": "12",
        "kind": "single-choice"
    },
    "q13": {
        "number": "13",
        "kind": "single-choice"
    },
    "q14": {
        "number": "14",
        "kind": "single-choice"
    },
    "q15": {
        "number": "15",
        "kind": "single-choice"
    },
    "q16": {
        "number": "16",
        "kind": "matching"
    },
    "q17": {
        "number": "17",
        "kind": "matching"
    },
    "q18": {
        "number": "18",
        "kind": "matching"
    },
    "q19": {
        "number": "19",
        "kind": "matching"
    },
    "q20": {
        "number": "20",
        "kind": "matching"
    }
},
    "answerKey": {
    "single": {
        "q11": "C",
        "q12": "A",
        "q13": "B",
        "q14": "A",
        "q15": "C"
    },
    "matching": {
        "q16": "A",
        "q17": "F",
        "q18": "G",
        "q19": "D",
        "q20": "B"
    }
},
    "transcriptLines": [["00:00","00:09","Part 2."],["00:09","00:15","You will hear a traffic police officer talking to a group of listeners about driving license application and traffic conditions in the UK."],["00:15","00:19","First, you have some time to look at questions 11 to 15."],["00:19","00:48","Now listen carefully and answer questions 11 to 15."],["00:48","00:53","Hello, I'm Edward and I'm here to tell you about road conditions in various areas of the UK."],["00:53","01:01","I'm also going to tell you about driver's licenses in the UK."],["01:01","01:07","If you have never had a driver's license or you have one from another country and you want to get a UK license, <span class='answer-highlight'>(Q11) you must be a UK resident</span>."],["01:07","01:12","You will need to show a medical report when your UK license needs to be renewed."],["01:12","01:17","If you are trying to translate your original foreign driving license to apply for a UK license, which is a must if you want to be able to drive here, <span class='answer-highlight'>(Q12) you will need to visit an official agency</span>."],["01:17","01:23","These are scattered throughout the London area and are well equipped to assist you with any questions you might have and any services they offer are included in your license fee."],["01:23","01:28","If you already have a translated license but need some personal information updating, you do not need to pay for the update, they'll do it for free."],["01:28","01:33","When you are getting a new driving license, you may need to have a new photo taken as some photos are rejected."],["01:33","01:36","It's actually okay if your photo is too small since we can get it enlarged with our printer."],["01:36","01:40","<span class='answer-highlight'>(Q13) The majority of rejected photos are the ones that were taken with a cream backdrop instead of a monotone grey background</span>."],["01:40","01:46","We've now found that photos with the latter allow us to identify the license holder much more easily."],["01:46","01:52","If you are wearing glasses on the previous photo, you don't need to worry about it since it is still allowed."],["01:52","01:56","If you are not sure whether your previous license is still valid, then the license checking service is for you."],["01:56","02:01","The procedures are quite clear and you just have to follow them."],["02:01","02:04","<span class='answer-highlight'>(Q14) Ideally, I would like to see the process going faster since it can take hours to finish</span>."],["02:04","02:10","From my standpoint, it will help if all the applicants bring the necessary identification with them, then all they have to do is just fill in the forms accordingly, step by step."],["02:10","02:15","I'm often asked whether I have a personal recommendation about the fastest or cheapest place to get all this done, but I think it really depends on where you are."],["02:15","02:19","They can all get busy at some point and when it is quiet at one branch, it may be busy in another, so take your pick."],["02:19","02:24","All I would say is that there is absolutely no difference in price, it's a standard fee."],["02:24","02:30","<span class='answer-highlight'>(Q15) The only advice I would give is that the quickest way to complete an application is to fill out the form on the internet and then bring a print copy with you to the agency location of your choice</span>."],["02:30","02:37","Before you hear the rest of the talk, you have some time to look at questions 16-20."],["02:37","02:41","Now listen carefully and answer questions 16-20."],["02:41","02:43","Next, people frequently ask me what I think of the road conditions in some of our cities."],["02:43","03:00","London is obviously the biggest and busiest and there are lots of parking restrictions, one-way systems and so on, <span class='answer-highlight'>(Q16) but on the whole I find the traffic signs are very clear</span>."],["03:00","03:06","In Edinburgh, most people use digital maps to get to know local traffic and road conditions, which can be estimated through different traffic flow lines."],["03:06","03:12","It is a city of lights, traffic lights, <span class='answer-highlight'>(Q17) but they're extremely efficient as they're timed perfectly to get the traffic flowing smoothly</span>."],["03:12","03:17","That's important because pedestrian areas and crossings are always packed with people on foot, which needs strong regulation."],["03:17","03:20","The city of Cardiff has tackled traffic flow in a different way."],["03:20","03:26","<span class='answer-highlight'>(Q18) It recently completed a road expansion scheme and the extra lanes of the dual carriageway are easing congestion</span>."],["03:26","03:31","It's a similar story in Manchester."],["03:31","03:37","<span class='answer-highlight'>(Q19) Instead of going through the town centre, most vehicles choose ring roads, so as to avoid the downtown congestion</span>."],["03:37","03:41","It can still happen though, so there's a possibility that the city will introduce checkpoints where the police can intervene to direct traffic at peak periods."],["03:41","03:44","And finally, they say all roads lead to Rome, and you could say that about Oxford."],["03:44","03:51","<span class='answer-highlight'>(Q20) I like the many options for getting in and out of the city because drivers can always find alternative routes</span>."],["03:51","03:57","The other cities in the UK are..."],["03:57","04:04","That is the end of part two."],["04:04","04:10","You now have 30 seconds to check your answers to part two."]],
    "questionsPageHtml": "<div data-section=\"1\">\n <div class=\"test-main-title\">Part 2</div>\n <div class=\"group\">\n <h4>Questions 11-15</h4>\n <p class=\"instructions\">Choose the correct letter, <b>A</b>, <b>B</b> or <b>C</b>.</p>\n <p><b>Driving license in UK</b></p>\n <p><b>11</b> What is the basic requirement for applying for a UK driving licence?</p>\n <label><input type=\"radio\" name=\"q11\" data-q=\"11\" value=\"A\"><b>A</b> a medical report.</label>\n <label><input type=\"radio\" name=\"q11\" data-q=\"11\" value=\"B\"><b>B</b> a valid licence from another country.</label>\n <label><input type=\"radio\" name=\"q11\" data-q=\"11\" value=\"C\"><b>C</b> current residency in the UK.</label>\n \n <p><b>12</b> What is true about the translation of original licences?</p>\n <label><input type=\"radio\" name=\"q12\" data-q=\"12\" value=\"A\"><b>A</b> applicants need to go to a recognised organisation.</label>\n <label><input type=\"radio\" name=\"q12\" data-q=\"12\" value=\"B\"><b>B</b> it is not always necessary for foreigners when applying for a UK licence.</label>\n <label><input type=\"radio\" name=\"q12\" data-q=\"12\" value=\"C\"><b>C</b> applicants need to pay an extra fee for translation services.</label>\n \n <p><b>13</b> When applying for a UK licence, which type of photos will NOT be approved?</p>\n <label><input type=\"radio\" name=\"q13\" data-q=\"13\" value=\"A\"><b>A</b> photos in which the applicant is wearing glasses.</label>\n <label><input type=\"radio\" name=\"q13\" data-q=\"13\" value=\"B\"><b>B</b> photos with a cream background.</label>\n <label><input type=\"radio\" name=\"q13\" data-q=\"13\" value=\"C\"><b>C</b> photos that are undersized.</label>\n \n <p><b>14</b> What does the speaker think of the license checking service?</p>\n <label><input type=\"radio\" name=\"q14\" data-q=\"14\" value=\"A\"><b>A</b> the process is too slow.</label>\n <label><input type=\"radio\" name=\"q14\" data-q=\"14\" value=\"B\"><b>B</b> the application form is confusing.</label>\n <label><input type=\"radio\" name=\"q14\" data-q=\"14\" value=\"C\"><b>C</b> some of the steps are unnecessary.</label>\n \n <p><b>15</b> What does the speaker recommend about making an application?</p>\n <label><input type=\"radio\" name=\"q15\" data-q=\"15\" value=\"A\"><b>A</b> choosing a quiet location.</label>\n <label><input type=\"radio\" name=\"q15\" data-q=\"15\" value=\"B\"><b>B</b> visiting the nearest branch.</label>\n <label><input type=\"radio\" name=\"q15\" data-q=\"15\" value=\"C\"><b>C</b> completing the forms online.</label>\n </div>\n </div>\n\n <div data-section=\"2\">\n <div class=\"group\">\n <h4>Questions 16-20</h4>\n <p class=\"instructions\">What is the current feature of traffic management in each of the following cities?</p>\n <p class=\"instructions\">Write the correct letter, <b>A-H</b>, next to Questions 16-20.</p>\n <div class=\"matching-flex\">\n <div class=\"match-list\">\n <div class=\"match-row\"><span class=\"match-q\"><b>16</b> London</span><span class=\"match-slot\" data-q=\"16\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>17</b> Edinburgh</span><span class=\"match-slot\" data-q=\"17\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>18</b> Cardiff</span><span class=\"match-slot\" data-q=\"18\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>19</b> Manchester</span><span class=\"match-slot\" data-q=\"19\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>20</b> Oxford</span><span class=\"match-slot\" data-q=\"20\"></span></div>\n </div>\n <div class=\"matching-options\">\n <strong>Features</strong>\n <div class=\"drag-pool\" data-reusable=\"false\">\n <div class=\"drag-option\" draggable=\"true\" data-value=\"A\">A good signage</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"B\">B multiple access roads</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"C\">C police control points</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"D\">D ring roads</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"E\">E one-way streets</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"F\">F effective traffic lights</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"G\">G additional lanes</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"H\">H pedestrianised areas</div>\n </div>\n </div>\n </div>\n </div>\n </div>\n <div class=\"results-in-page\"></div>"
  });
})(typeof window !== 'undefined' ? window : globalThis);
