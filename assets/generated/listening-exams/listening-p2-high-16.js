(function registerListeningExamData(global) {
  'use strict';
  if (!global.__LISTENING_EXAM_DATA__ || typeof global.__LISTENING_EXAM_DATA__.register !== "function") {
    throw new Error("listening_exam_registry_missing");
  }
  global.__LISTENING_EXAM_DATA__.register("listening-p2-high-16", {
    "schemaVersion": "ListeningExamSourceV1",
    "examId": "listening-p2-high-16",
    "meta": {
      "title": "Information for Fire Wardens",
      "category": "P2",
      "frequency": "high",
      "audioSrc": "/assets/listening/audio/listening-p2-high-16.mp3",
      "localStorageKey": "ieltsListening_fireWardens_v2"
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
        "kind": "matching"
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
        "q11": "B",
        "q12": "C",
        "q13": "C",
        "q14": "C"
    },
    "matching": {
        "q15": "A",
        "q16": "A",
        "q17": "B",
        "q18": "B",
        "q19": "A",
        "q20": "C"
    }
},
    "transcriptLines": [["00:00","00:14","You will hear a company manager talking to staff about procedures to follow if a fire breaks out at work. First, you have some time to look at questions 11-14 on page 3."],["00:30","00:59","Now, listen carefully and answer questions 11-14."],["01:00","01:07","Hello, and thanks to everyone for being on time. The meeting will be fairly short and will only be looking at fire procedures. I had a similar meeting with the senior fire officers earlier today, but you're all here because you've volunteered to act as fire wardens for your own particular department, and for some of you this will be your first time in the role."],["01:07","01:13","Although you'll probably have taken part in several fire drills since you've been here, but now the construction workers finished and we have a couple of new corridors and stairways, we need the meeting to update everyone."],["01:13","01:17","And before I forget, you might have noticed a bit of upgrading last week. The hand held fire extinguishes, the standard ones on the wall, the reports says they're all working well, as is the overhead sprinkler system, but the old alarm system has been replaced and should be a lot more reliable."],["01:17","01:22","Anyway, as fire wardens, you have a number of responsibilities."],["01:22","01:26","Okay, those wardens responsible for the factory buildings, you'll remember we had a minor fire back in January. Luckily, the fire doors around the room stopped most of the smoke from getting out, but the alarm should have been pressed a lot earlier. From what I understand, staff felt somewhat reluctant to activate it themselves and were looking for someone's senior, so please ensure that everyone knows it's their responsibility to take action immediately."],["01:26","01:32","Can you also make sure that if anyone knew has been hired since then, that they've read the fire notices?"],["01:32","01:39","And wardens for office departments, you'll also have to have a word with your staff. When the fire alarm went off in January in that minor fire, people got out of the office building pretty quickly. That was fine, but once they were out, they stood right in front of the doors, so if the fire crews had needed to access the offices, they would have been prevented. Good to see that everyone had left their bags and stuff behind though."],["01:39","01:45","Before you hear the rest of the talk, you have some time to look at questions 15 to 20 on page 4."],["03:41","03:47","Now listen and answer questions 15 to 20."],["03:51","03:57","Okay, next on the agenda, there's a few aspects of fire safety that we need to go through with all you wardens. Firstly, we want to make sure that when we have the next fire drill, there's nothing blocking the way in the escape routes. No obstacles, I mean, so please have a look at that as soon as possible. We want to be able to get outside very quickly."],["03:57","04:03","One thing that should definitely be on your to-do list is making sure no one's locked the fire doors and that it's easy enough to get through them."],["04:03","04:09","Now, you might remember that last year we had a fire officer come and visit and show us what to do if we see a colleague starting to suffer from the effects of smoke inhalation. Well, the same office is coming back to lead another session."],["04:09","04:15","Another issue is how to handle the fire extinguishers. Someone from the local fire department has booked in to teach people how to do that. I think it would be a good idea of fire wardens and department staff attended those sessions."],["04:15","04:20","Let's see what else is on the list. Oh, yes, the evacuation points. The green area behind the main car park, the pavement on Hunter Street, and the unused area behind the factory car park."],["04:20","04:26","Fire wardens need to make sure all staff are familiar with these locations for evacuation, so please send our emails directly after the meeting."],["04:26","04:31","And the last point is to do with flammable liquids. I believe there have been a few concerns about where they were being stored in the warehouse, but that's been resolved now."],["04:31","04:37","However, if anyone has anything else to report, do let me know."],["05:27","05:33","That is the end of section two. You now have half a minute to check your answers."]],
    "questionsPageHtml": "<div data-section=\"1\">\n <div class=\"group\">\n <h4>Questions 11-14</h4>\n <p class=\"instructions\">Choose the correct letter, <b>A</b>, <b>B</b> or <b>C</b>.</p>\n <p><b>11</b> The company is having this meeting about fire procedures because</p>\n <label><input type=\"radio\" name=\"q11\" data-q=\"11\" value=\"A\"><b>A</b> employees did badly in the last annual fire drill.</label>\n <label><input type=\"radio\" name=\"q11\" data-q=\"11\" value=\"B\"><b>B</b> there have been changes in the building layout.</label>\n <label><input type=\"radio\" name=\"q11\" data-q=\"11\" value=\"C\"><b>C</b> new staff have joined the company.</label>\n\n <p><b>12</b> There has been a recent upgrade to</p>\n <label><input type=\"radio\" name=\"q12\" data-q=\"12\" value=\"A\"><b>A</b> the sprinkler system.</label>\n <label><input type=\"radio\" name=\"q12\" data-q=\"12\" value=\"B\"><b>B</b> the fire extinguishers.</label>\n <label><input type=\"radio\" name=\"q12\" data-q=\"12\" value=\"C\"><b>C</b> the alarm system.</label>\n\n <p><b>13</b> During the minor fire in January, some staff working in the factory</p>\n <label><input type=\"radio\" name=\"q13\" data-q=\"13\" value=\"A\"><b>A</b> were unable to read fire notices.</label>\n <label><input type=\"radio\" name=\"q13\" data-q=\"13\" value=\"B\"><b>B</b> left fire doors open.</label>\n <label><input type=\"radio\" name=\"q13\" data-q=\"13\" value=\"C\"><b>C</b> were unwilling to start the fire alarm.</label>\n\n <p><b>14</b> In the fire in January, the problem with office staff was that they</p>\n <label><input type=\"radio\" name=\"q14\" data-q=\"14\" value=\"A\"><b>A</b> refused to leave personal items behind.</label>\n <label><input type=\"radio\" name=\"q14\" data-q=\"14\" value=\"B\"><b>B</b> moved too slowly during the evacuation.</label>\n <label><input type=\"radio\" name=\"q14\" data-q=\"14\" value=\"C\"><b>C</b> did not move far away enough from the building.</label>\n </div>\n </div>\n\n <div data-section=\"2\">\n <div class=\"group matching\">\n <h4>Questions 15-20</h4>\n <p class=\"instructions\">What comment does the speaker make about each of the following aspects of fire safety?</p>\n <p>Write the correct letter, <b>A</b>, <b>B</b> or <b>C</b>, next to Questions 15-20.</p>\n <div class=\"matching-flex\">\n <div class=\"match-list\">\n <div class=\"match-row\"><span class=\"match-q\"><b>15</b> ensuring there are no obstacles in fire escape routes</span><span class=\"match-slot\" data-q=\"15\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>16</b> checking that fire doors are easily opened</span><span class=\"match-slot\" data-q=\"16\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>17</b> showing staff how to look after each other</span><span class=\"match-slot\" data-q=\"17\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>18</b> training staff to use fire extinguishers correctly</span><span class=\"match-slot\" data-q=\"18\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>19</b> checking that staff are aware of evacuation points</span><span class=\"match-slot\" data-q=\"19\"></span></div>\n <div class=\"match-row\"><span class=\"match-q\"><b>20</b> checking that flammable liquids are properly stored</span><span class=\"match-slot\" data-q=\"20\"></span></div>\n </div>\n <div class=\"matching-options\">\n <strong>Comments</strong>\n <div class=\"drag-pool\" data-reusable=\"true\">\n <div class=\"drag-option\" draggable=\"true\" data-value=\"A\">A It should be a priority for fire wardens</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"B\">B It will be dealt with by an external specialist</div>\n <div class=\"drag-option\" draggable=\"true\" data-value=\"C\">C It does not require attention</div>\n </div>\n </div>\n </div>\n </div>\n </div>\n <div class=\"results-in-page\"></div>"
  });
})(typeof window !== 'undefined' ? window : globalThis);
