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

// Helper functions for color conversion
function rgbToHex(rgb) {
  let result = rgb.match(/\d+/g);
  return '#' + ((1 << 24) + (parseInt(result[0]) << 16) + (parseInt(result[1]) << 8) + parseInt(result[2])).toString(16).slice(1);
}

function hexToRgb(hex) {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
}

function hsvToRgb(h, s, v) {
  let r, g, b;
  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

// Helper functions for color conversion
function rgbToHex(rgb) {
  let result = rgb.match(/\d+/g);
  return '#' + ((1 << 24) + (parseInt(result[0]) << 16) + (parseInt(result[1]) << 8) + parseInt(result[2])).toString(16).slice(1);
}

function hexToRgb(hex) {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
}

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
    let round = parseInt($(this).attr("round"));

    // Check if this is the first time any input in this round is being changed
    if (!roundsAddedToChart.has(round)) {
      addRowToChart();
      roundsAddedToChart.add(round);
    }

    // for each round in the table
    let data = [0];
    for (let i = 1; i < $("tr.round").length + 1; i++) {
      updateScore(player, i); // update cum score
      data.push(calculateScore(player, i));
    }

    config.data.datasets[player-1].data = data.slice(0, getLatestRoundWithValidData(player) + 1);
    chart.update();

    let totalRounds = $("tr.round").length;
    if (round == totalRounds) {
      // Check if all turn-inputs in the current row are filled
      let inputs = $(`input[round=${round}]`);
      let allInputsFilled = true;
      
      inputs.each(function() {
        if ($(this).val() === '' || $(this).val() === undefined || $(this).val() === null) {
          allInputsFilled = false;
          return false;
        }
      });
      
      if (allInputsFilled && inputs.length > 0) {
        addRowToTable();
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
  
  let addInputElement = function(i, element) {
    if ($(this).children().length < 2*count+1) {
      let input = $("<input/>").addClass("turn-input").attr("player", count).attr("round", i+1).attr("type", "number");
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
    // Create table header with editable input
    let playerNameInput = $("<input>").addClass("player-name-input").attr({"type": "text", "value": "Playa " + count, "player": count});
    let headerCell = $("<th>").attr("colspan", 2).append(playerNameInput);
    $("#playa-row").append(headerCell);
    
    $("#heada-row").append($("<th>").append($("<span>turn</span>").addClass("subcol")));
    $("#heada-row").append($("<th>").append($("<span>cum.</span>").addClass("subcol")));
    $(".round").each(addInputElement); // Add input elements to existing rounds

    // Add change listeners to player's inputs
    let player = count;
    $("input[player=" + player + "]:not(.player-name-input)").on("input", createScoreInputListener(player));
    addPlayerToChart(player);
    
    // Add change listener for player name input in table header
    playerNameInput.on("input", function() {
      let player = parseInt($(this).attr("player"));
      config.data.datasets[player-1].label = $(this).val(); // Update chart
      // Update corresponding dropdown input
      $(".dropdown-menu").children().eq(player).find("input").val($(this).val());
      chart.update();
      saveGame();
    });

    // Add focus listener to auto-select text when clicking
    playerNameInput.on("focus", function() {
      this.select();
    });
    
    // Create dropdown player name input
    let dropdownItem = $("<div>").addClass(["input-group", "input-group-sm", "dropdown-item", "player-name-div"]);
    let prepend = $("<div>").addClass("input-group-prepend");
    let span = $("<span>").addClass("input-group-text").text("Player " + player + ":");
    
    // Create color square showing player's chart color
    let colorSquare = $('<div>').addClass('player-color-square')
      .css('background-color', window.chartColors[player-1])
      .attr('data-player', player)
      .on('click', function(e) {
        e.stopPropagation();
        let playerNum = parseInt($(this).attr('data-player'));
        
        // Create custom color picker modal
        let modal = $('<div>').css({
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: '10000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        });
        
        let colorPicker = $('<div>').css({
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          maxWidth: '300px',
          maxHeight: '90vh',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        });
        
        // Title
        let title = $('<div>').text('Choose Color').css({
          textAlign: 'center',
          marginBottom: '15px',
          fontWeight: 'bold',
          fontSize: '16px'
        });
        
        // Color canvas for hue/saturation selection
        let canvasContainer = $('<div>').css({
          position: 'relative',
          width: '200px',
          height: '200px',
          margin: '0 auto 15px auto',
          border: '1px solid #ccc',
          cursor: 'crosshair'
        });
        
        let canvas = $('<canvas>').attr({width: 200, height: 200}).css({
          width: '100%',
          height: '100%',
          display: 'block'
        });
        
        let ctx = canvas[0].getContext('2d');
        
        // Draw color canvas
        function drawColorCanvas() {
          let imageData = ctx.createImageData(200, 200);
          for (let x = 0; x < 200; x++) {
            for (let y = 0; y < 200; y++) {
              let hue = x / 200;
              let saturation = 1 - (y / 200);
              let value = 1;
              let rgb = hsvToRgb(hue, saturation, value);
              let match = rgb.match(/\d+/g);
              let index = (y * 200 + x) * 4;
              imageData.data[index] = parseInt(match[0]);     // R
              imageData.data[index + 1] = parseInt(match[1]); // G  
              imageData.data[index + 2] = parseInt(match[2]); // B
              imageData.data[index + 3] = 255;               // A
            }
          }
          ctx.putImageData(imageData, 0, 0);
        }
        
        drawColorCanvas();
        
        // Brightness slider
        let brightnessContainer = $('<div>').css({
          marginBottom: '15px',
          textAlign: 'center'
        });
        
        let brightnessLabel = $('<div>').text('Brightness').css({
          marginBottom: '5px',
          fontSize: '14px'
        });
        
        let brightnessSlider = $('<input>').attr({
          type: 'range',
          min: 0,
          max: 100,
          value: 100
        }).css({
          width: '180px'
        });
        
        // Current color preview
        let colorPreview = $('<div>').css({
          width: '60px',
          height: '30px',
          border: '1px solid #ccc',
          margin: '0 auto 15px auto',
          borderRadius: '3px',
          backgroundColor: window.chartColors[playerNum-1]
        });
        
        let currentHue = 0;
        let currentSaturation = 1;
        let currentBrightness = 1;
        
        // Handle canvas clicks
        canvasContainer.on('mousedown touchstart', function(e) {
          e.preventDefault();
          let rect = canvas[0].getBoundingClientRect();
          let clientX = e.clientX || (e.originalEvent.touches && e.originalEvent.touches[0].clientX);
          let clientY = e.clientY || (e.originalEvent.touches && e.originalEvent.touches[0].clientY);
          let x = clientX - rect.left;
          let y = clientY - rect.top;
          
          currentHue = Math.max(0, Math.min(1, x / 200));
          currentSaturation = Math.max(0, Math.min(1, 1 - (y / 200)));
          
          updatePreview();
        });
        
        // Handle brightness changes
        brightnessSlider.on('input', function() {
          currentBrightness = $(this).val() / 100;
          updatePreview();
        });
        
        function updatePreview() {
          let color = hsvToRgb(currentHue, currentSaturation, currentBrightness);
          colorPreview.css('backgroundColor', color);
        }
        
        // Buttons
        let buttonContainer = $('<div>').css({
          textAlign: 'center'
        });
        
        let selectBtn = $('<button>').text('Select').css({
          padding: '8px 16px',
          marginRight: '10px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }).on('click', function() {
          let selectedColor = hsvToRgb(currentHue, currentSaturation, currentBrightness);
          
          // Update the color square
          colorSquare.css('background-color', selectedColor);
          
          // Update the chart color
          window.chartColors[playerNum-1] = selectedColor;
          if (config.data.datasets[playerNum-1]) {
            config.data.datasets[playerNum-1].backgroundColor = selectedColor;
            config.data.datasets[playerNum-1].borderColor = selectedColor;
          }
          chart.update();
          saveGame();
          
          modal.remove();
        });
        
        let cancelBtn = $('<button>').text('Cancel').css({
          padding: '8px 16px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }).on('click', function() {
          modal.remove();
        });
        
        // Assemble picker
        canvasContainer.append(canvas);
        brightnessContainer.append(brightnessLabel).append(brightnessSlider);
        buttonContainer.append(selectBtn).append(cancelBtn);
        colorPicker.append(title).append(canvasContainer).append(brightnessContainer).append(colorPreview).append(buttonContainer);
        modal.append(colorPicker);
        $('body').append(modal);
        
        // Close modal when clicking outside
        modal.on('click', function(e) {
          if (e.target === modal[0]) {
            modal.remove();
          }
        });
      });
    
    let dropdownInput = $("<input>").addClass(["form-control", "player-name"]).attr({"type": "text", "aria-label": "small", value: "Playa " + player});
    dropdownInput.on("input", function() {
      let player = parseInt($(this).prev().text().split(" ")[1]);
      let newName = $(this).val();
      // Update table header input
      $("#playa-row").children().eq(player).find("input").val(newName);
      // Update chart
      config.data.datasets[player-1].label = newName;
      chart.update();
      saveGame();
    });
    dropdownItem.append(prepend.append(span)).append(dropdownInput).append(colorSquare);
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

function addRowToTable() {
  let row = $("<tr></tr>").addClass("round");
  let playerCount = parseInt($("#player-count").text());
  let newRound = $("tr.round").length + 1;
  
  $("<td></td>").addClass("round-td").text(newRound + ":").css("font-weight", "bold").appendTo(row);
  for (let i = 1; i <= playerCount; i++) {
    let input = $("<input/>").addClass("turn-input").attr("player", i).attr("round", newRound).attr("type", "number");
    $("<td></td>").append(input).appendTo(row);
    $("<td>0</td>").attr("id", `${i}-${newRound}`).appendTo(row);
  }
  row.appendTo("table");

  // Hide scores for "nonexistant" players (so if a removed player is added back they have a score for the round)
  for (let i = parseInt($("#player-count").text()) + 1; i <= playerCount; i++) {
    $(".round").eq(-1).children().eq(2*i).hide();
    $(".round").eq(-1).children().eq(2*i+1).hide();
  }
  
  // Update scores for newly added row
  for (let i = 1; i <= playerCount; i++) {
    updateScore(i, newRound);
  }
  
  // Set previous turns inputs to new scorebox
  for (let player = 1; player <= playerCount; player++) {
    $(`input[player=${player}]:not(.player-name-input)`).on("input", createScoreInputListener(player));
  }
}

function addRowToChart() {
  let round = $("tr.round").length;
  config.data.labels.push(round);
  chart.update();
  saveGame();
}

function nextTurn() {
  addRowToTable();
  addRowToChart();
}

function calculateScore(player, round) {
  let score = 0;
  let inputs = $(`input[player=${player}]:not(.player-name-input)`);
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
  roundsAddedToChart = new Set([1]); // Reset to initial state
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
  let names = $("#playa-row").children("th:not(:first-child)").find("input").map((i, e) => e.value).get();
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
    $("#playa-row").children().eq(i+1).find("input").val(names[i]);
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
    nextTurn();
    addPlayer();
    addPlayer();
  }

  /*// Add focus listener to all player name inputs for auto-select
  $(".player-name-input").on("focus", function() {
    this.select();
  });*/

  //toggleDarkMode();
});
