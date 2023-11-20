$(function () {
	let FADE_TIME = 150; // ms
	let TYPING_TIMER_LENGTH = 400; // ms
	let COLORS = [
		'#e21400', '#91580f', '#f8a700', '#f78b00',
		'#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
		'#3b88eb', '#3824aa', '#a700ff', '#d300e7'
	];

	// Initialize variables
	let $window = $(window);
	let $messages = $('.chatMessages'); // Messages area
	let $inputMessage = $('.inputText'); // Input message input box

	// Prompt for setting a username
	let username;
	let connected = false;
	let typing = false;
	let lastTypingTime;
	let $currentInput = $inputMessage.focus();

	const usersBoxElement = document.getElementById('UsersBox');

	let socket = io();

	var windowWidth = window.innerWidth;
	var windowHeight = window.innerHeight;
	var x = windowWidth / 2;
	var y = windowHeight / 2;
	var lastX = x;
	var lastY = y;
	var newX = 0;
	var newY = 0;
	var minX = 0;
	var minY = 0;
	var maxX = windowWidth;
	var maxY = windowHeight;

	var canvasElement;
	var canvasContext;
	var isDrawing = false;
	var xLocked = false;
	var yLocked = false;
	var drawSpeed = 5;
	var angle = 0;

	function drawLine(x1, y1, x2, y2){
		canvasContext.beginPath();
		canvasContext.strokeStyle = "black";
		canvasContext.lineWidth = 2;
		canvasContext.moveTo(x1, y1);
		canvasContext.lineTo(x2, y2);
		canvasContext.stroke();
		canvasContext.closePath();
	}

	function DegToRad(degrees) {
		var pi = Math.PI;
		return degrees * (pi/180);
	}

	window.addEventListener("deviceorientation", handleOrientation, true);

	const addParticipantsMessage = (data) => {
		let message = '';
		if (data.numUsers === 1) {
			message += "seš tu sám kámo";
		} else {
			message += "celkový počet čuníků - " + data.numUsers;
		}
		$('#usersCount').empty().append('<span>' + data.numUsers + '</span>');
		log(message);
	};

	function makeId(length) {
		let result = '';
		let characters = '0123456789';
		let charactersLength = characters.length;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	}

	// Sets the client's username
	const setUsername = () => {
		username = "TULák_" + makeId(5) + " ";

		// If the username is valid
		if (username) {
			$currentInput = $inputMessage.focus();

			// Tell the server your username
			socket.emit('add user', username);
		}
	};

	// Sends a chat message
	const sendMessage = () => {
		let message = $inputMessage.val();
		// Prevent markup from being injected into the message
		message = cleanInput(message);
		// if there is a non-empty message and a socket connection
		if (message && connected) {
			$inputMessage.val('');
			addChatMessage({
				username: username,
				message: message
			});
			// tell server to execute 'new message' and send along one parameter
			socket.emit('new message', message);
		}
	};

	// Log a message
	const log = (message, options) => {
		let $el = $('<div>').addClass('log').text(message);
		addMessageElement($el, options);
	};

	// Adds the visual chat message to the message list
	const addChatMessage = (data, options) => {
		// Don't fade the message in if there is an 'X was typing'
		let $typingMessages = getTypingMessages(data);
		options = options || {};
		if ($typingMessages.length !== 0) {
			options.fade = false;
			$typingMessages.remove();
		}

		let $usernameDiv = $('<span class="username"/>')
			.text(data.username)
			.css('color', getUsernameColor(data.username));
		let $messageBodyDiv = $('<span class="messageBody">')
			.text(data.message);

		let typingClass = data.typing ? 'typing' : '';
		let $messageDiv = $('<div class="message"/>')
			.data('username', data.username)
			.addClass(typingClass)
			.append($usernameDiv, $messageBodyDiv);

		addMessageElement($messageDiv, options);
	};

	// Adds the visual chat typing message
	const addChatTyping = (data) => {
		data.typing = true;
		data.message = '... píše moudro';
		addChatMessage(data);
	};

	// Removes the visual chat typing message
	const removeChatTyping = (data) => {
		getTypingMessages(data).fadeOut(function () {
			$(this).remove();
		});
	};

	// Adds a message element to the messages and scrolls to the bottom
	// el - The element to add as a message
	// options.fade - If the element should fade-in (default = true)
	// options.prepend - If the element should prepend
	//   all other messages (default = false)
	const addMessageElement = (el, options) => {
		let $el = $(el);

		// Setup default options
		if (!options) {
			options = {};
		}
		if (typeof options.fade === 'undefined') {
			options.fade = true;
		}
		if (typeof options.prepend === 'undefined') {
			options.prepend = true;
		}

		// Apply options
		if (options.fade) {
			$el.hide().fadeIn(FADE_TIME);
		}
		if (options.prepend) {
			$messages.prepend($el);
		} else {
			$messages.append($el);
		}
		$messages[0].scrollTop = $messages[0].scrollHeight;
	};

	// Prevents input from having injected markup
	const cleanInput = (input) => {
		return $('<div/>').text(input).html();
	};

	// Updates the typing event
	const updateTyping = () => {
		if (connected) {
			if (!typing) {
				typing = true;
				socket.emit('typing');
			}
			lastTypingTime = (new Date()).getTime();

			setTimeout(() => {
				let typingTimer = (new Date()).getTime();
				let timeDiff = typingTimer - lastTypingTime;
				if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
					socket.emit('stop typing');
					typing = false;
				}
			}, TYPING_TIMER_LENGTH);
		}
	};

	// Gets the 'X is typing' messages of a user
	const getTypingMessages = (data) => {
		return $('.typing.message').filter(function (i) {
			return $(this).data('username') === data.username;
		});
	};

	// Gets the color of a username through our hash function
	const getUsernameColor = (username) => {
		// Compute hash code
		let hash = 7;
		for (let i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + (hash << 5) - hash;
		}
		// Calculate color
		let index = Math.abs(hash % COLORS.length);
		return COLORS[index];
	};

	// Keyboard events
	setUsername();

	$window.keydown(event => {
		// When the client hits ENTER on their keyboard
		if (event.which === 13) {
			sendMessage();
			socket.emit('stop typing');
			typing = false;
		}
	});

	$inputMessage.on('input', () => {
		updateTyping();
	});

	// Focus input when clicking on the message input's border
	$window.click(() => {
		$inputMessage.focus();
	});

	// Socket events

	// Whenever the server emits 'login', log the login message
	socket.on('login', (data) => {
		connected = true;
		addParticipantsMessage(data);
	});

	// Whenever the server emits 'new message', update the chat body
	socket.on('new message', (data) => {
		//addChatMessage(data);
		angle = data.message.alpha;

		newX = Math.round(lastX + 5 * Math.cos(DegToRad(angle)));
		newY = Math.round(lastY + 5 * Math.sin(DegToRad(angle)));
		if (newX < minX) {
			newX = minX;
		} else if (newX > maxX) {
			newX = maxX;
		}

		if (newY < minY) {
			newY = minY;
		} else if (newY > maxY) {
			newY = maxY;
		}

		drawLine(lastX, lastY, newX, newY);

		lastX = newX;
		lastY = newY;

		console.log(data.message.alpha);
	});

	// Whenever the server emits 'user joined', log it in the chat body
	socket.on('user joined', (data) => {
		log(data.username + ' se připojil');
		addParticipantsMessage(data);
		//var newUserElement = document.createElement('div');
		//newUserElement.setAttribute("class", "userBoxElement");
		//console.log(COLORS[0]);
		//newUserElement.style.backgroundColor = "#00ff00";
		//usersBoxElement.appendChild(newUserElement);
	});

	// Whenever the server emits 'user left', log it in the chat body
	socket.on('user left', (data) => {
		log(data.username + ' se odpojil');
		addParticipantsMessage(data);
		removeChatTyping(data);
	});

	// Whenever the server emits 'typing', show the typing message
	socket.on('typing', (data) => {
		addChatTyping(data);
	});

	// Whenever the server emits 'stop typing', kill the typing message
	socket.on('stop typing', (data) => {
		removeChatTyping(data);
	});

	socket.on('disconnect', () => {
		log('byl jsi vyhozen');
	});

	socket.on('reconnect', () => {
		log('byl jsi znovu připojen');
		if (username) {
			socket.emit('add user', username);
		}
	});

	socket.on('reconnect_error', () => {
		log('něco se ošklivým způsobem nepovedlo');
	});

	socket.on('updateusers', function(data) {
		$('#users').empty();
		$.each(data, function(key, value) {
			let uniqueColor = getUsernameColor(key);
			$('#users').append('<span style="color: ' + uniqueColor + '">' + key + '</span>');
		});
	});

	var elementX = document.getElementById("GyroX");
	var elementY = document.getElementById("GyroY");
	var elementZ = document.getElementById("GyroZ");

	window.addEventListener("deviceorientation", handleOrientation, true);

	function handleOrientation(event) {
		var absolute = event.absolute;
		var alpha    = event.alpha;
		var beta     = event.beta;
		var gamma    = event.gamma;

		//console.log(absolute);
		console.log(alpha);
		//console.log(beta);
		//console.log(gamma);

		elementX.innerText = alpha;
		elementY.innerText = beta;
		elementZ.innerText = gamma;

		//socket.emit("new message", alpha + " | " + beta + " | " + gamma);
		socket.emit("new message", {
			alpha: alpha,
			beta: beta,
			gamma: gamma
		});
	}

	setInterval(function () {
		//getLocation();
	}, 1000);

	//var x = document.getElementById("demo");
	function getLocation() {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(showPosition);
		} else {
			//x.innerHTML = "Geolocation is not supported by this browser.";
			console.log("Geolocation is not supported by this browser");
		}
	}

	function showPosition(position) {
		console.log(position.coords.latitude + " | " + position.coords.longitude);
		//x.innerHTML = "Latitude: " + position.coords.latitude +
		//"<br>Longitude: " + position.coords.longitude;
	}

	// wait for the content of the window element
// to load, then performs the operations.
// This is considered best practice.
	window.addEventListener('load', ()=>{
		canvasElement = document.getElementById("canvas");
		canvasElement.width = windowWidth;
		canvasElement.height = windowHeight;

		canvasContext = canvasElement.getContext("2d");
		resize(); // Resizes the canvas once the window loads
		document.addEventListener('mousedown', startPainting);
		document.addEventListener('mouseup', stopPainting);
		document.addEventListener('mousemove', sketch);
		window.addEventListener('resize', resize);
	});

	const canvas = document.querySelector('#canvas');

// Context for the canvas for 2 dimensional operations
	const ctx = canvas.getContext('2d');

// Resizes the canvas to the available size of the window.
	function resize(){
		ctx.canvas.width = window.innerWidth;
		ctx.canvas.height = window.innerHeight;
	}

// Stores the initial position of the cursor
	let coord = {x:0 , y:0};

// This is the flag that we are going to use to
// trigger drawing
	let paint = false;

// Updates the coordianates of the cursor when
// an event e is triggered to the coordinates where
// the said event is triggered.
	function getPosition(event){
		coord.x = event.clientX - canvas.offsetLeft;
		coord.y = event.clientY - canvas.offsetTop;
	}

// The following functions toggle the flag to start
// and stop drawing
	function startPainting(event){
		paint = true;
		getPosition(event);
	}
	function stopPainting(){
		paint = false;
	}

	function sketch(event){
		if (!paint) return;
		ctx.beginPath();

		ctx.lineWidth = 5;

		// Sets the end of the lines drawn
		// to a round shape.
		ctx.lineCap = 'round';

		ctx.strokeStyle = 'green';

		// The cursor to start drawing
		// moves to this coordinate
		ctx.moveTo(coord.x, coord.y);

		// The position of the cursor
		// gets updated as we move the
		// mouse around.
		getPosition(event);

		// A line is traced from start
		// coordinate to this coordinate
		ctx.lineTo(coord.x , coord.y);

		// Draws the line.
		ctx.stroke();
	}
});
