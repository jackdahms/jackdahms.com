/*
 * TODO
 * Dark mode
 * Rooms
 * What to do when invalid score entered?
 *   - bootstrap alert?
 *   - highlight box red?
 * Alert when trying to remove 2nd player or add a 7th player
 * Options for trendline to force prediction for which player will win
 * Button to remove turns
 */

window.chartColors = [
	'rgb(255, 99, 132)', // red
	'rgb(54, 162, 235)', // blue
	'rgb(255, 205, 86)', // yellow
	'rgb(75, 192, 192)', // green
	'rgb(255, 159, 64)',
	'rgb(153, 102, 255)',
	'rgb(201, 203, 207)'
];

let chart = null;
let config = {
  type: 'line',
  data: {
    labels: [0],
    datasets: []
  },
  options: {
    responsive: true,
    tooltips: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'nearest',
      intersect: true
    },
    legend: {
      labels: {
        boxWidth: 20
      }
    },
    scales: {
      x: {
        display: true,
        scaleLabel: {
          display: true,
          labelString: 'Round'
        }
      },
      y: {
        display: true,
        scaleLabel: {
          display: true,
          labelString: 'Score'
        }
      },
      yAxes: [{
        ticks: {
          beginAtZero: true,
          suggestedMax: 10
        }
      }]
    }
  }
};
let theme = "light";
let minorDelimiter = String.fromCharCode(28); // For delimiting pieces of information in one chunk, e.g. one name from another
let majorDelimiter = String.fromCharCode(29); // For delimiting different pieces of info from one another, e.g. names from scores

function getLatestRoundWithValidData(player) {
  let latestRoundWithValidData = 0
  let inputs = $(`input[player=${player}]`);
  for (let round = inputs.length; round > 0; round--) {
    let value = parseInt(inputs[round-1].value);
    if (!isNaN(value)) {
      latestRoundWithValidData = round;
      break;
    } 
  }
  return latestRoundWithValidData;
}

function addPlayerToChart(player) {
  // Re-add player to chart
  config.data.datasets.push({
    label: 'Playa ' + player,
    backgroundColor: window.chartColors[player-1],
    borderColor: window.chartColors[player-1],
    data: [0],
    fill: false,
  });
  
  let latestRoundWithValidData = getLatestRoundWithValidData(player);
  for (let round = 1; round <= latestRoundWithValidData; round++) {
    config.data.datasets[player-1].data.push($(`#${player}-${round}`).text());
  }
}

function keepDropdownOpen(e) {
  if (!(e == undefined)) {
    e.stopPropagation(); // keep settings from closing automatically
    $('.dropdown-toggle').dropdown('toggle'); // close and
    $('.dropdown-toggle').dropdown('toggle'); // reopen to correct formatting
  } 
}

function createScoreInputListener(player) {
  return function() {
    // for each round in the table
    let data = [0];
    for (let i = 1; i < $("tr.round").length + 1; i++) {
      updateScore(player, i); // update cum score
      data.push(calculateScore(player, i));
    }

    config.data.datasets[player-1].data = data.slice(0, getLatestRoundWithValidData(player) + 1);
    chart.update();
    saveGame();
  }
}

function addPlayer(e) {
  keepDropdownOpen(e);
  
  let count = parseInt($("#player-count").text()) + 1;
  if (count > 6) {
    return;
  }
  $("#player-count").text(count);
  
  let addInputElement = function(i, element) {
    if ($(this).children().length < 2*count+1) {
      let input = $("<input/>").addClass("turn-input").attr("player", count).attr("round", i).attr("type", "number");
      $(this).append($("<td>").append(input));
      $(this).append($("<td>0</td>").attr("id", `${count}-${i+1}`));
    } else {
      $(this).children().eq(2*count-1).show();
      $(this).children().eq(2*count).show();
    }
  }
  
  // if there are any hidden players (player row has a spacer and then a column for every player)
  if (count+1 <= $("#playa-row").children().length) {
    // Un-round previous table corners
    $("#playa-row").children().eq(count-1).css("border-top-right-radius", "0px");
    $("#heada-row").children().eq(2*count-2).css("border-bottom-right-radius", "0px");
    $(".round").each(function() {
      $(this).children().eq(2*count-2).css("border-top-right-radius", "0px");
      $(this).children().eq(2*count-2).css("border-bottom-right-radius", "0px");
    });
    
    $("#playa-row").children().eq(count).show();
    $("#heada-row").children().eq(2*count-1).show();
    $("#heada-row").children().eq(2*count).show();
    $(".dropdown-menu").children().eq(count).show();
    $(".round").each(addInputElement);
    
    addPlayerToChart(count);
    config.data.datasets[count-1].label = $(".dropdown-menu").children().eq(count).find("input").val(); // update chart's player name
  } else {
    $("#playa-row").append($("<th>Playa " + count + "</th>").attr("colspan", 2));
    $("#heada-row").append($("<th>").append($("<span>turn</span>").addClass("subcol")));
    $("#heada-row").append($("<th>").append($("<span>cum.</span>").addClass("subcol")));
    $(".round").each(addInputElement); // Add input elements to existing rounds

    // Add change listeners to player's inputs
    let player = count;
    $("input[player=" + player + "]").on("input", createScoreInputListener(player));
    addPlayerToChart(player);
    
    let dropdownItem = $("<div>").addClass(["input-group", "input-group-sm", "dropdown-item", "player-name-div"]);
    let prepend = $("<div>").addClass("input-group-prepend");
    let span = $("<span>").addClass("input-group-text").text("Player " + player + ":");
    let input = $("<input>").addClass(["form-control", "player-name"]).attr({"type": "text", "aria-label": "small", value: "Playa " + player});
    input.on("input", function() {
      let player = parseInt($(this).prev().text().split(" ")[1]);
      $("#playa-row").children().eq(player).text($(this).val()); // Update table header
      config.data.datasets[player-1].label = $(this).val(); // Update chart
      chart.update();
      saveGame();
    });
    dropdownItem.append(prepend.append(span)).append(input);
    dropdownItem.insertBefore($(".dropdown-menu").children().last());
  }
  chart.update();
  saveGame();
}

function removePlayer(e) {
  let count = parseInt($("#player-count").text());
  if (count > 2) {
    // Hide input elements so we can save their scores/name in case they want to add them back
    $("#playa-row").children().eq(count).hide();
    $("#heada-row").children().eq(2*count-1).hide();
    $("#heada-row").children().eq(2*count).hide();
    $(".round").each(function() {
      $(this).children().eq(2*count-1).hide();
      $(this).children().eq(2*count).hide();
    });
    $(".dropdown-menu").children().eq(count).hide();
    
    count--;
    $("#player-count").text(count);
    
    // Round correct table corners
    $("#playa-row").children().eq(count).css("border-top-right-radius", "5px");
    $("#heada-row").children().eq(2*count).css("border-bottom-right-radius", "5px");
    $(".round").each(function() {
      $(this).children().eq(2*count).css("border-top-right-radius", "5px");
      $(this).children().eq(2*count).css("border-bottom-right-radius", "5px");
    });
    
    config.data.datasets.pop();
    chart.update();
  }
  
  keepDropdownOpen(e);
  saveGame();
}

function nextTurn() {
  let row = $("<tr></tr>").addClass("round");
  let playerCount = parseInt($("#player-count").text());
  let round = $("tr").length - 1;
  $("<td></td>").addClass("round-td").text(round + ":").css("font-weight", "bold").appendTo(row);
  for (let i = 1; i <= playerCount; i++) {
    let input = $("<input/>").addClass("turn-input").attr("player", i).attr("round", round).attr("type", "number");
    $("<td></td>").append(input).appendTo(row);
    $("<td>0</td>").attr("id", `${i}-${round}`).appendTo(row);
  }
  row.appendTo("table");
  
  // Hide scores for "nonexistant" players (so if a removed player is added back they have a score for the round)
  for (let i = parseInt($("#player-count").text()) + 1; i <= playerCount; i++) {
    $(".round").eq(-1).children().eq(2*i).hide();
    $(".round").eq(-1).children().eq(2*i+1).hide();
  }
  
  // Update scores for newly added row
  for (let i = 1; i <= playerCount; i++) {
    updateScore(i, round);
  }
  
  // Set previous turns inputs to new scorebox
  for (let player = 1; player <= playerCount; player++) {
    $(`input[player=${player}]`).on("input", createScoreInputListener(player));
  }
  
  config.data.labels.push(round);
  chart.update();
  saveGame();
}

function calculateScore(player, round) {
  let score = 0;
  let inputs = $(`input[player=${player}]`);
  for (let i = 0; i < round; i++) {
    let value = parseInt(inputs[i].value);
    if (isNaN(value)) {
      
    } else {
      score += value;
    } 
  }
  return score;
}

function updateScore(player, round) {
  $(`#${player}-${round}`).text(calculateScore(player, round));
}

function resetGame() {
  $("tr").remove();
  let playaRow = $("<tr>").attr("id", "playa-row").addClass("rounded").append("<th>");
  let headaRow = $("<tr>").attr("id", "heada-row").addClass("rounded").append("<th>");
  $("table").append(playaRow).append(headaRow);

  config.data.labels = [0];
  config.data.datasets = [];
  chart.update();
  
  $(".player-name-div").remove();  
  let playerCount = parseInt($("#player-count").text());
  $("#player-count").text(0);
  for (let i = 0; i < playerCount; i++) {
    addPlayer();
  }
  nextTurn();
  chart.update();
  saveGame();
}

function toggleDarkMode() {
  /*
  dark mode chart config example:
  options: {
    legend: {
      labels: {
        fontColor: 'white'
      }
    },
    title: {
      fontColor: 'white'
    },
    scale: {
      ticks: {
        fontColor: 'white', 
        showLabelBackdrop: false // hide square behind text
      },
      gridLines: {
        color: 'rgba(255, 255, 255, 0.2)'
      },
      angleLines: {
        color: 'white' // lines radiating from the center
      }
  */
  
  if (theme == "light") {
    theme = "dark";
    
    $("body").css({
      "background": "#223",
      "color": "#FFF"
    });
    $("th").css({
      "background": "#668"
    });
    $(".round-td").css({
      "color": "#FFF"
    });
    $("td:nth-child(2n + 1)").css({
      "border-right": "1px solid #557"
    });
  } else {
    theme = "light";
    
    $("body").css({
      "background": "#FFF",
      "color": "#000"
    });
    $("th").css({
      "background": "#047"
    });
    $(".round-td").css({
      "color": "#047"
    });
    $("td:nth-child(2n + 1)").css({
      "border-right": "1px solid #CCC"
    });
  }
}

function saveGame() {
  let playerCount = parseInt($("#player-count").text());
  let names = $("#playa-row").children("th:not(:first-child)").map((i, e) => e.innerText).get();
  let roundCount = $("tr.round").length;
  let scores = $(".turn-input").map((i, e) => e.value).get(); 
  let stateString = playerCount + majorDelimiter 
                  + names.join(minorDelimiter) + majorDelimiter 
                  + roundCount + majorDelimiter 
                  + scores.join(minorDelimiter);
  document.cookie = "game=" + encodeURIComponent(stateString);
}

function loadGame() {
  let nameEQ = "game=";
  let ca = document.cookie.split(';');
  let gameState = "";
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1, c.length);
    }
    if (c.indexOf(nameEQ) === 0) {
      gameState = decodeURIComponent(c.substring(nameEQ.length, c.length));
      break;
    }
  }

  if (gameState == "") {
    return false;
  }

  let majors = gameState.split(majorDelimiter);
  let playerCount = majors[0];
  let names = majors[1].split(minorDelimiter);
  let roundCount = majors[2];
  let scores = majors[3].split(minorDelimiter);

  for (let i = 0; i < names.length; i++) {
    //if (i > 1) addPlayer();
    addPlayer();
    $("input.player-name").last().val(names[i]);
    $("input.player-name").last().trigger("input");
  }

  let k = 0;
  while (k < scores.length) {
    //if (k > 0) nextTurn();
    nextTurn();
    for (let j = 0; j < names.length; j++) {
      //if (scores[k] == "") scores[k] = 0;
      $(".turn-input").eq(k).val(scores[k]);
      $(".turn-input").eq(k).trigger("input");
      k++;
    }
  }

  while (names.length > playerCount) {
    removePlayer();
    names.pop();
  }

  return true;
}

$(function() {  
  let ctx = $("#chart"); 
  chart = new Chart(ctx, config);
  
  $("#next-turn-button").click(nextTurn);
  $("#plus-button").click(addPlayer);
  $("#minus-button").click(removePlayer);
  $("#reset-button").click(resetGame);

  if (!loadGame()) {
    nextTurn();
    addPlayer();
    addPlayer();
  }
  
  //toggleDarkMode();
});
