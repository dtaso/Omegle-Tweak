/* 
	This code will just connect you to the omegle server and a random video peer
	For anyone interested in the connecting part without having to check the bloat frontend stuff
*/
interface backendEvent {
	name: string;
	data?: any;
}

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

const stats = {
	id: "",
	server: "front26",
	rtc: {
		call: false,
		peer: false,
		candidates:[]
	},
	reset() {
		stats.id = "";
		stats.rtc = {
			call: false,
			peer: false,
			candidates:[]
		}
	}
};

const encodeObjectAndAddID = function (data?:object) {
	const form = {
		data: [],
		append(key:string,value:string) {
			this.data.push(key + "=" + encodeURIComponent(value));
		}
	}
	form.append("id", stats.id);
	if (data) {
		for (const key in data) {
			const value = data[key];
			if (typeof value == "string") {
				form.append(key, value);
			} else if (typeof value == "object") (
				form.append(key, JSON.stringify(value))
			)
		}
	}
	return form.data.join("&");
};

const clearArray = function (array:any[]) {
	return array.splice(0, array.length);
};

const backend = {
	async sendPOST(path:string, data:string) {
		return fetch(`https://${stats.server}.omegle.com/${path}`, {
			method: 'POST',
			body: data,
			headers: {
				"content-type": "application/x-www-form-urlencoded; charset=UTF-8"
			},
			referrerPolicy: "no-referrer"
		});
	},
	sendEncodedPOST(path:string, data:object) {
		return backend.sendPOST(path, encodeObjectAndAddID(data))
	},
	connect: (args:string[]) => fetch(`https://${stats.server}.omegle.com/start?${args.join("&")}`, { method: 'POST', referrerPolicy: "no-referrer" }).then(response => response.json()),
	disconnect() {
		return backend.sendPOST("disconnect", "id=" + encodeURIComponent(stats.id));
	},
	events() {
		return new WebSocket(`wss://${stats.server}.omegle.com/wsevents?id=${encodeURIComponent(stats.id)}`);
	}
};

const newChat = async function () {
	const eventHandler = {
		executer: async function (event:backendEvent) {
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
				default:
					console.log(event);
					break;
			}
		},
		parser(events:object[]) {
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
		backend.sendPOST("rtcpeerdescription", encodeObjectAndAddID({desc: session}));
	};

	stats.reset();

	const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true } });
	
	const pc = new RTCPeerConnection(WEB_RTC_CONFIG);

	media.getTracks().forEach(function(track) {
		pc.addTrack(track, media);
	});

	pc.ontrack = function (event) {

	}
	pc.onicecandidate = async function (event) {
		if (pc.iceGatheringState != "complete") {
			await backend.sendEncodedPOST("icecandidate", {candidate: event.candidate});
			clearArray(stats.rtc.candidates);
		}
	}

	const args = [
		"caps=recaptcha2",
		"firstevents=0",
		"spid=",
		"randid=4ALLVR8L", 
		`lang=en`,
		`webrtc=1`
	];
	
	const start = await backend.connect(args);
	eventHandler.parser(start.events);
	stats.id = start.clientID;

	backend.events();

	const socket = backend.events();
	socket.onmessage = function (rawevents) {
		const events = JSON.parse(rawevents.data);
		eventHandler.parser(events);
	};
}