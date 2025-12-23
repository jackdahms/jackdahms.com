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
let roundsAddedToChart = new Set([1]); // Track which rounds have been added to chart
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

function setupInputTabNavigation() {
  // Set up custom tab navigation for turn inputs
  $(document).off('keydown', '.turn-input').on('keydown', '.turn-input', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      let currentPlayer = parseInt($(this).attr('player'));
      let currentRound = parseInt($(this).attr('round'));
      let playerCount = parseInt($("#player-count").text());
      
      let nextPlayer, nextRound;
      
      if (e.shiftKey) {
        // Shift+Tab: go to previous player, same round (or previous round if at top)
        if (currentPlayer > 1) {
          nextPlayer = currentPlayer - 1;
          nextRound = currentRound;
        } else {
          // At top player, go to last player of previous round
          nextPlayer = playerCount;
          nextRound = currentRound - 1;
        }
      } else {
        // Tab: go to next player, same round (or next round if at bottom)
        if (currentPlayer < playerCount) {
          nextPlayer = currentPlayer + 1;
          nextRound = currentRound;
        } else {
          // At bottom player, go to first player of next round
          nextPlayer = 1;
          nextRound = currentRound + 1;
        }
      }
      
      // Find and focus the target input
      let targetInput = $(`input[player="${nextPlayer}"][round="${nextRound}"]`);
      if (targetInput.length > 0) {
        targetInput.focus();
      }
    }
  });
}

function createScoreInputListener(player) {
  return function() {
    let round = parseInt($(this).attr("round"));

    // Check if this is the first time any input in this round is being changed
    if (!roundsAddedToChart.has(round)) {
      addColToChart();
      roundsAddedToChart.add(round);
    }

    // for each round in the table
    let data = [0];
    let totalRounds = $("#header-row").children().length - 1; // subtract 1 for player header
    for (let i = 1; i <= totalRounds; i++) {
      updateScore(player, i); // update cum score
      data.push(calculateScore(player, i));
    }

    config.data.datasets[player-1].data = data.slice(0, getLatestRoundWithValidData(player) + 1);
    chart.update();

    if (round == totalRounds) {
      // Check if all turn-inputs in the current column are filled
      let inputs = $(`input[round=${round}]`);
      let allInputsFilled = true;
      
      inputs.each(function() {
        if ($(this).val() === '' || $(this).val() === undefined || $(this).val() === null) {
          allInputsFilled = false;
          return false;
        }
      });
      
      if (allInputsFilled && inputs.length > 0) {
        addColToTable();
      }
    }

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
  
  // Check if player row already exists (hidden)
  let existingRow = $("#player-rows").children().eq(count - 1);
  if (existingRow.length > 0) {
    existingRow.show();
    $(".dropdown-menu").children().eq(count).show();
    addPlayerToChart(count);
    config.data.datasets[count-1].label = $(".dropdown-menu").children().eq(count).find("input").val();
  } else {
    // Create new player row
    let playerRow = $("<tr>").addClass("player-row").attr("player", count);
    let playerNameCell = $("<td>").addClass("player-name-cell").text("Playa " + count);
    playerRow.append(playerNameCell);
    
    // Add cells for existing rounds
    let roundCount = $("#header-row").children().length - 1; // subtract 1 for player header
    for (let round = 1; round <= roundCount; round++) {
      let input = $("<input/>").addClass("turn-input").attr("player", count).attr("round", round).attr("type", "number");
      let inputCell = $("<td>").append(input);
      playerRow.append(inputCell);
    }
    
    $("#player-rows").append(playerRow);

    // Add change listeners to player's inputs
    let player = count;
    $("input[player=" + player + "]").on("input", createScoreInputListener(player));
    setupInputTabNavigation();
    addPlayerToChart(player);
    
    let dropdownItem = $("<div>").addClass(["input-group", "input-group-sm", "dropdown-item", "player-name-div"]);
    let prepend = $("<div>").addClass("input-group-prepend");
    let span = $("<span>").addClass("input-group-text").text("Player " + player + ":");
    let input = $("<input>").addClass(["form-control", "player-name"]).attr({"type": "text", "aria-label": "small", value: "Playa " + player});
    input.on("input", function() {
      let player = parseInt($(this).prev().text().split(" ")[1]);
      $("tr[player=" + player + "] .player-name-cell").text($(this).val()); // Update table row
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
    // Hide player row so we can save their scores/name in case they want to add them back
    $("tr[player=" + count + "]").hide();
    $(".dropdown-menu").children().eq(count).hide();
    
    count--;
    $("#player-count").text(count);
    
    config.data.datasets.pop();
    chart.update();
  }
  
  keepDropdownOpen(e);
  saveGame();
}

function addColToTable() {
  let playerCount = parseInt($("#player-count").text());
  let newRound = $("#header-row").children().length; // current round count including player header
  
  // Add round header
  $("#header-row").append($("<th>").text("R" + newRound));
  
  // Add input cell to each player row
  for (let i = 1; i <= playerCount; i++) {
    let input = $("<input/>").addClass("turn-input").attr("player", i).attr("round", newRound).attr("type", "number");
    let inputCell = $("<td>").append(input);
    $("tr[player=" + i + "]").append(inputCell);
  }
  
  // Set change listeners for new inputs
  for (let player = 1; player <= playerCount; player++) {
    $("input[player=" + player + "][round=" + newRound + "]").on("input", createScoreInputListener(player));
  }
  setupInputTabNavigation();
}

function addColToChart() {
  let round = $("#header-row").children().length - 1; // subtract 1 for player header
  config.data.labels.push(round);
  chart.update();
  saveGame();
}

function nextTurn() {
  addColToTable();
  addColToChart();
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
  // Score is now calculated and displayed in chart, not in table cells
  // This function is kept for compatibility but doesn't update table cells
}

function resetGame() {
  // Clear table content
  $("#header-row").empty().append($("<th>").text("Player")).append($("<th>").text("R1"));
  $("#player-rows").empty();

  config.data.labels = [0];
  config.data.datasets = [];
  roundsAddedToChart.clear(); // Clear the tracking when resetting
  chart.update();
  
  $(".player-name-div").remove();  
  let playerCount = parseInt($("#player-count").text());
  $("#player-count").text(0);
  for (let i = 0; i < playerCount; i++) {
    addPlayer();
  }
  // Add initial chart label for round 1 (since R1 is already in HTML)
  config.data.labels.push(1);
  roundsAddedToChart.add(1);
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
  let names = $(".player-name-cell").map((i, e) => e.innerText).get();
  let roundCount = $("#header-row").children().length - 1; // subtract 1 for player header
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

  nextTurn();
  let k = 0;
  while (k < scores.length) {
    for (let j = 0; j < names.length; j++) {
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
  
  $("#plus-button").click(addPlayer);
  $("#minus-button").click(removePlayer);
  $("#reset-button").click(resetGame);

  if (!loadGame()) {
    // Add initial chart label for round 1 (since R1 is already in HTML)
    config.data.labels.push(1);
    roundsAddedToChart.add(1);
    addPlayer();
    addPlayer();
    setupInputTabNavigation();
  } else {
    setupInputTabNavigation();
  }
  
  //toggleDarkMode();
});
