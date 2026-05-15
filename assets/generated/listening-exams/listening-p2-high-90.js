(function registerListeningExamData(global) {
  'use strict';
  if (!global.__LISTENING_EXAM_DATA__ || typeof global.__LISTENING_EXAM_DATA__.register !== "function") {
    throw new Error("listening_exam_registry_missing");
  }
  global.__LISTENING_EXAM_DATA__.register("listening-p2-high-90", {
    "schemaVersion": "ListeningExamSourceV1",
    "examId": "listening-p2-high-90",
    "meta": {
      "title": "MUFS",
      "category": "P2",
      "frequency": "high",
      "audioSrc": "../../assets/listening/audio/listening-p2-high-90.mp3",
      "localStorageKey": "ielts_mufs_enhanced"
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
        "kind": "single-choice"
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
        "q12": "A",
        "q13": "C",
        "q14": "A",
        "q15": "B",
        "q16": "C"
    },
    "matching": {
        "q17": "B",
        "q18": "E",
        "q19": "C",
        "q20": "D"
    }
},
    "transcriptLines": [["00:00","00:13","You will hear the chairperson of the Middletown Urban Farming scheme talking to a group of people who are interested in joining the scheme."],["00:16","00:23","First, you have some time to look at questions 11-16."],["01:13","01:22","I'm Chris Butler, and I'm the chairperson of the Middletown Urban Farming scheme, or MUFS for short."],["01:22","01:32","Who started MUFS? Well, the idea of urban farming has been around among town planners."],["01:34","01:47","But it was actually a group of <span class='answer-highlight'>Middletown business people</span>, including myself, who decided to create what became MUFS. <b>(Q11 B)</b>"],["01:50","02:00","University specialists got involved later."],["01:53","02:10","Initially, the aim was not eco-friendly; it was simply to <span class='answer-highlight'>maximize the utilization of vacant land</span> within the city. <b>(Q12 A)</b>"],["02:10","02:17","Later we realized an additional benefit might be a healthier diet."],["02:21","02:29","We've got many schools and corporate employees involved."],["02:29","02:40","But for next year, we're going to concentrate on getting various <span class='answer-highlight'>community centers</span> to join. <b>(Q13 C)</b>"],["02:47","02:58","The core committee are dedicated gardeners; they will give hands-on <span class='answer-highlight'>gardening suggestions</span>. <b>(Q14 A)</b>"],["03:11","03:24","For physically disabled, we have window boxes and larger <span class='answer-highlight'>containers</span> free of charge. <b>(Q15 B)</b>"],["03:37","03:45","Work with schools: teachers didn't anticipate the change in attitude—students became more conscious of environment, <span class='answer-highlight'>community pride</span>. <b>(Q16 C)</b>"],["04:50","04:56","Now a number of local organizations provide free goods and services."],["04:58","05:12","The city hospital runs a course on how to use vegetables in dishes → <span class='answer-highlight'>cooking lessons</span>. <b>(Q17 B)</b>"],["05:12","05:29","Local government allows members to use a large glass building (greenhouse) free → <span class='answer-highlight'>use of a greenhouse</span>. <b>(Q18 E)</b>"],["05:29","05:45","The university will test soil samples and give <span class='answer-highlight'>advice on soil</span> and nutrients. <b>(Q19 C)</b>"],["05:45","05:58","A supermarket offers classes on how to lose weight and stay healthy → <span class='answer-highlight'>eat-to-keep-fit course</span>. <b>(Q20 D)</b>"],["06:01","06:09","That is the end of section 2."]],
    "questionsPageHtml": ""
  });
})(typeof window !== 'undefined' ? window : globalThis);
