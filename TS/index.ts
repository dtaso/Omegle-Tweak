interface domObject {
	tag: string;
	args?: args;
	child?: domObject;
};

interface args {
	accessKey?: string;
	autocapitalize?: string;
	dir?: string;
	draggable?: boolean;
	hidden?: boolean;
	innerText?: string;
	lang?: string;
	spellcheck?: boolean;
	title?: string;
	translate?: boolean;
	autofocus?: boolean;
	nonce?: string;
	tabIndex?: number;
	contentEditable?: string;
	enterKeyHint?: string;
	inputMode?: string;
	className?: string;
	id?: string;
	innerHTML?: string;
	outerHTML?: string;
	scrollLeft?: number;
	scrollTop?: number;
	slot?: string;
	nodeValue?: string | null;
	textContent?: string | null;
	/* [key: string]: unknown */
};

type dStatus = "stop" | "rlly" | "new";
type author = "you" | "stranger";
type pcOption = "Offer" | "Answer";

const WEB_RTC_CONFIG = {
	iceServers: [{
		urls: "stun:stun.l.google.com:19302"
	}, {
		urls: "stun:stun.services.mozilla.com"
	}]
};
const WEB_RTC_MEDIA_CONSTRAINTS = {
	mandatory: {
		OfferToReceiveAudio: true,
		OfferToReceiveVideo: true
	}
};
const WEB_RTC_PEER_CONSTRAINTS = {
	optional: [{
		DtlsSrtpKeyAgreement: true
	}]
};

const createElement = function (domObject:domObject) {
	const element = document.createElement(domObject.tag);
	if (domObject.args) {
		for (const [key, value] of Object.entries(domObject.args)) {
			element[key] = value;
		}
	}
	if (domObject.child) {
		element.appendChild(createElement(domObject.child));
	}
	return element;
};

const createChild = function (parent:string, domObject:domObject) {
	const child = createElement(domObject);
	document.querySelector(parent).appendChild(child);
};

const clearChilds = function (nodeName:string) {
	const node = document.querySelector(nodeName);
	node.textContent = "";
};

const chatNode = {
	logbox: document.querySelector(".logbox"),
	typebox: (document.querySelector(".chatmsg") as HTMLTextAreaElement),
	add: {
		message: function (message:string, sender:author) {
			const pclass = `${sender}msg`;
			const user = sender == "you" ? "You" : "Stranger";
			createChild(".logbox", {
				tag: "div",
				child: {
					tag: "p",
					args: {
						className: pclass,
						innerHTML: `<strong class="msgsource">${user}: </strong>`,
					},
					child: {
						tag: "span",
						args: {
							textContent: message
						}
					}
				}
			});
		},
		status: {
			default: function (text:string) {
				createChild(".logbox",{
					tag: "div",
					args: {
						className: "logitem"
					},
					child: {
						tag: "p",
						args: {
							className: "statuslog",
							textContent: text
						}
					}
				});
				chatNode.scroll();
			},
			connected: function () {
				chatNode.add.status.default("You're now chatting with a random stranger.");
			},
			typing: function () {
				createChild(".logbox",{
					tag: "div",
					args: {
						className: "logitem typing"
					},
					child: {
						tag: "p",
						args: {
							className: "statuslog",
							innerText: "Stranger is typing..."
						}
					}
				});
				stats.typing = true;
				chatNode.scroll();
			},
			likes: function (likes:string[]) {
				let display:string;
				if (likes.length < 0) {
					display = "Couldn't find a stranger with same interests.";
				}
				else if (likes.length == 1) {
					display = `You both like ${likes[0]}.`;
				}
				else if (likes.length > 1) {
					const body = likes.join(", ");
					const last = likes.pop();
					display = `You both like ${body} and ${last}.`;
					
				} 
				chatNode.add.status.default(display);
			},
		},
	},
	remove: function () {
		clearChilds(".logbox");
	},
	scroll: function () {
		chatNode.logbox.scroll(0, chatNode.logbox.scrollHeight);
	}
};

const disconnectNode = {
	txt: document.querySelector(".dscnttxt"),
	btn: document.querySelector(".dscntbtn"),
	set: function (text:dStatus) {
		switch (text) {
			case "stop":
				disconnectNode.btn.className = "dscntbtn stop";
				disconnectNode.txt.textContent = "Stop";
				break;
			
			case "rlly":
				disconnectNode.btn.className = "dscntbtn rlly";
				disconnectNode.txt.textContent = "Really?";
				break;
			
			case "new":
				disconnectNode.btn.className = "dscntbtn new";
				disconnectNode.txt.textContent = "New";
				break;
		}
	},
	handler: function () {
		switch (disconnectNode.btn.classList[1]) {
			case "stop":
				disconnectNode.set("rlly")
				break;
			
			case "rlly":
				disconnectNode.set("new");
				backend.disconnect();
				break;

			case "new":
				disconnectNode.set("stop");
				backend.video_chat();
				break;
		}
	}
};

const videoNode = {
	othervideo: (document.querySelector("#othervideo") as HTMLVideoElement),
	selfvideo: (document.querySelector("#selfvideo") as HTMLVideoElement)
};

const spinnerNode = {
	add: function () {
		createChild("#videowrapper", {tag: "div", args:{className:"spinner"}});
	},
	remove: function () {
		document.querySelector(".spinner").remove();
	}
}

function encode(data:object) {
	return encodeURIComponent(JSON.stringify(data));
}

function clearArray(array:any[]) {
	return array.splice(0, array.length);
}

const stats = {
	id: "",
	server: "front26",
	connected: false,
	typing: false,
	rtc: {
		call: false,
		peer: false,
		candidates:[]
	},
	reset: function () {
		stats.id = "";
		stats.typing = false;
		stats.connected = false;
		/* stats.server = ""; */
		stats.rtc = {
			call: false,
			peer: false,
			candidates:[]
		}
	}
};

const settings = {
	data: {
		autoskip: false,
		likes: ["lgbt", "lgbtq"],
	},
	get: function () {
		const item = JSON.parse(localStorage.getItem('settings'));
		if (item) {
			settings.data = item; 
		}
	},
	save: function () {
		localStorage.setItem('settings', JSON.stringify(settings.data));
	},
	clear: function () {
		localStorage.clear();
	}
};

const disconnectHandler = function (user:string) {
	if (stats.connected) {
		chatNode.add.status.default(`${user} Disconnected`);
		disconnectNode.set("new");
		stats.connected = false;
		spinnerNode.remove();
	}
}

const keyboard = {
	init: function () {
		document.querySelector(".chatmsg").addEventListener("keydown",keyboard.handler.chatbox);
		document.body.addEventListener("keydown",keyboard.handler.doc);
	},
	handler: {
		doc: function (key:KeyboardEvent) {
			if (key.code == "Escape") {
				if (key.shiftKey && stats.connected) {
					key.preventDefault();
					backend.disconnect();
					backend.video_chat();
				} else {
					key.preventDefault();
					disconnectNode.handler();
				}
			}
		},
		chatbox: function (key:KeyboardEvent) {
			if (key.code == "Enter" && !key.shiftKey && stats.connected) {
				key.preventDefault();
				backend.sendmsg();
			}
		}
	}
};

const backend = {
	sendPOST: async function (path:string, data = "") {
		const url = `https://${stats.server}.omegle.com/${path}`;
		const id = encodeURIComponent(stats.id)
		data = data == "" ? `id=${id}` : `id=${id}&${data}`;
		return fetch(url, {
			method: 'POST',
			body: data,
			headers: {
				"content-type": "application/x-www-form-urlencoded; charset=UTF-8"
			}
		});
	},
	sendmsg: function () {
		if (stats.connected) {
			if (chatNode.typebox.value == "") {return;}
			backend.sendPOST("send", `msg=${encodeURIComponent(chatNode.typebox.value)}`)
			chatNode.add.message(chatNode.typebox.value, "you");
			chatNode.typebox.value = "";
		}
	},
	connect: (args:string[]) => fetch(`https://${stats.server}.omegle.com/start?${args.join("&")}`, { method: 'POST' }).then(response => response.json()),
	disconnect: function () {
		disconnectHandler("You");
		videoNode.othervideo.srcObject = null;
		return backend.sendPOST("disconnect");
	},
	video_chat: async function () {
		const eventHandler = {
			executer: async function (event) {
				switch (event.name) {
					case "rtccall":
						stats.rtc.call = true;
						descriptionHandler("Offer");
						break;
					case "rtcpeerdescription":
						const answer = new RTCSessionDescription(event.data);
						await pc.setRemoteDescription(answer)
						stats.rtc.peer = true;
						for (let i = 0; i < stats.rtc.candidates.length; i++) {
							const signal = stats.rtc.candidates[i];
							await pc.addIceCandidate(new RTCIceCandidate(signal));
						}
						stats.rtc.candidates.splice(0, stats.rtc.candidates.length)
						if (!stats.rtc.call) {
							descriptionHandler("Answer");
						}
						break;
					case "icecandidate":
						if (!stats.rtc.peer) {
							stats.rtc.candidates.push(event.data);
						} else {
							pc.addIceCandidate(new RTCIceCandidate(event.data));
						}
						break;
					case "gotMessage":
						chatNode.add.message(event.data, "stranger");
						break;
					case "commonLikes":
						chatNode.add.status.likes(event.data);
						break;
					case "connected":
						stats.connected = true;
						chatNode.add.status.connected();
						break;
					case "strangerDisconnected":
						socket.close();
						videoNode.othervideo.srcObject = null;
						disconnectHandler("Stranger");
						break;
					case "waiting":
						chatNode.add.status.default("Waiting");
						break;
					default:
						console.log(event);
						break;
				}
			},
			parser: function (events) {
				for (let i = 0; i < events?.length; i++) {
					const event = {
						name: events[i][0],
						data: events[i][1]
					};
					eventHandler.executer(event);
				}
			}
		};

		const descriptionHandler = async function (option:pcOption) {
			const session = await pc[`create${option}`](WEB_RTC_MEDIA_CONSTRAINTS);
			await pc.setLocalDescription(session)
			backend.sendPOST("rtcpeerdescription", `desc=${encode(session)}`);
		};

		stats.reset();

		disconnectNode.set("stop");

		chatNode.remove();
		chatNode.typebox.value = "";
		chatNode.add.status.default("Conneting to server");
		spinnerNode.add();

		const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true } });
		videoNode.selfvideo.srcObject ??= media;
		videoNode.selfvideo.muted = true;
		
		const pc = new RTCPeerConnection(WEB_RTC_CONFIG);

		media.getTracks().forEach(function(track) {
			pc.addTrack(track, media);
		});

		pc.ontrack = function (event) {
			videoNode.othervideo.srcObject = event.streams[0];
			spinnerNode.remove();
		}
		pc.onicecandidate = async function (event) {
			await backend.sendPOST("icecandidate", `candidate=${encode(event.candidate)}`);
			clearArray(stats.rtc.candidates);
		}

		const args = [
			"caps=recaptcha2",
			"firstevents=0",
			"spid=",
			"randid=4ALLVR8L", 
			`topics=${encode(settings.data.likes)}`,
			"lang=en",
			"camera=Full%20HD%20webcam%20(0bda%3A58b0)",
			"webrtc=1"
		];
		
		const start = await backend.connect(args);
		eventHandler.parser(start.events);
		stats.id = start.clientID;

		const socket = new WebSocket(`wss://${stats.server}.omegle.com/wsevents?id=${encodeURIComponent(start.clientID)}`);
		socket.onmessage = function (rawevents) {
			const events = JSON.parse(rawevents.data);
			eventHandler.parser(events);
		};
	}
};

keyboard.init();