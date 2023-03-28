/*
 * If not stated otherwise in this file or this component's license file the
 * following copyright and licenses apply:
 *
 * Copyright 2018 RDK Management
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

var controlObj = null;
var bitrateList = [];
var ccStatus = false;
var disableButtons = false;
var currentObjID = "";
const xreCCOptions1 = { textItalicized: false, textEdgeStyle:"none", textEdgeColor:"black", textSize: "large", windowFillColor: "black", fontStyle: "default", textForegroundColor: "black", windowFillOpacity: "transparent", textForegroundOpacity: "solid", textBackgroundColor: "white", textBackgroundOpacity:"solid", windowBorderEdgeStyle: "none", windowBorderEdgeColor: "blue", textUnderline: false };
const xreCCOptions2 = { textItalicized: true, textEdgeStyle:"none", textEdgeColor:"black", textSize: "small", windowFillColor: "black", fontStyle: "default", textForegroundColor: "blue", windowFillOpacity: "transparent", textForegroundOpacity: "solid", textBackgroundColor: "red", textBackgroundOpacity:"solid", windowBorderEdgeStyle: "none", windowBorderEdgeColor: "blue", textUnderline: true };
const ccOptions1 = {"penItalicized":false,"textEdgeStyle":"none","textEdgeColor":"black","penSize":"small","windowFillColor":"black","fontStyle":"default","textForegroundColor":"black","windowFillOpacity":"transparent","textForegroundOpacity":"solid","textBackgroundColor":"cyan","textBackgroundOpacity":"solid","windowBorderEdgeStyle":"none","windowBorderEdgeColor":"black","penUnderline":false};
const ccOptions2 = {"penItalicized":false,"textEdgeStyle":"none","textEdgeColor":"red","penSize":"large","windowFillColor":"black","fontStyle":"default","textForegroundColor":"red","windowFillOpacity":"transparent","textForegroundOpacity":"solid","textBackgroundColor":"black","textBackgroundOpacity":"solid","windowBorderEdgeStyle":"none","windowBorderEdgeColor":"red","penUnderline":false};
// create cc option object for xre receiver cc rendering
var xreCCOptions = {};

for(var option in ccOptions) {
    if( option === "penItalicized") {
        xreCCOptions.textItalicized = ccOptions[option];
    } else if ( option === "penSize") {
        xreCCOptions.textSize = ccOptions[option];
    } else if ( option === "penUnderline") {
        xreCCOptions.textUnderline = ccOptions[option];
    } else {
        xreCCOptions[option] = ccOptions[option];
    }
}

function playPause() {
    console.log("playPause");

    if (playerState === playerStatesEnum.idle) {
        //Play first video when clicking Play button first time
        document.getElementById("contentURL").innerHTML = "URL: " + urls[0].url;
        resetPlayer();
        resetUIOnNewAsset();
        loadUrl(urls[0], true);
    } else {
        // If it was a trick play operation
        if ( playbackSpeeds[playbackRateIndex] != 1 ) {
            // Change to normal speed
            playerObj.play();
        } else {
            if (playerState === playerStatesEnum.paused) {
                // Play the video
                playerObj.play();
            } else { // Pause the video
                playerObj.pause();
            }
        }
        playbackRateIndex = playbackSpeeds.indexOf(1);
    }
};

function mutePlayer() {
    if (mutedStatus === false) {
        // Mute
        playerObj.setVolume(0);
        mutedStatus = true;
        document.getElementById("muteIcon").src = "../icons/mute.png";
    } else {
        // Unmute
        playerObj.setVolume(100);
        mutedStatus = false;
        document.getElementById("muteIcon").src = "../icons/unMute.png";
    }
};

function toggleCC() {
    if (ccStatus === false) {
        // CC ON
        if(enableNativeCC) {
            playerObj.setClosedCaptionStatus(true);
            playerObj.setTextStyleOptions(JSON.stringify(ccOptions));
        } else {
            XREReceiver.onEvent("onClosedCaptions", { enable: true });
            XREReceiver.onEvent("onClosedCaptions", { setOptions: xreCCOptions});
            //set this to xreCCOptions1 (large) instead of xreCCOptions
            //XREReceiver.onEvent("onClosedCaptions", { setOptions: xreCCOptions1});
        }
        ccStatus = true;
        document.getElementById("ccIcon").src = "../icons/closedCaptioning.png";
        document.getElementById('ccContent').innerHTML = "CC Enabled";    
    } else {
        // CC OFF
        if(enableNativeCC) {
            playerObj.setClosedCaptionStatus(false);
        } else {
            XREReceiver.onEvent("onClosedCaptions", { enable: false });
        }
        ccStatus = false;
        document.getElementById("ccIcon").src = "../icons/closedCaptioningDisabled.png";
        document.getElementById('ccContent').innerHTML = "CC Disabled";
    }
    document.getElementById('ccModal').style.display = "block";
    setTimeout(function(){  document.getElementById('ccModal').style.display = "none"; }, 2000);
};

function goToHome() {
    window.location.href = "../index.html";
}

function skipTime(tValue) {
    //if no video is loaded, this throws an exception
    try {
        var position = playerObj.getCurrentPosition();
        if (!isNaN(position)) {
            if(document.getElementById("seekCheck").checked) {
                // call old seek API
                playerObj.seek(position + tValue);
            } else {
                // call new seek API with support to seek with pause
                playerObj.pause();
                playerObj.seek(position + tValue, true);
            }
        }
    } catch (err) {
        // errMessage(err) // show exception
        errMessage("Video content might not be loaded: " + err);
    }
}

function skipBackward() {
    skipTime(-300);
};

function skipForward() {
    skipTime(300);
};

function fastrwd() {
    var newSpeedIndex = playbackRateIndex - 1;
    if (newSpeedIndex < 0) {
        newSpeedIndex = 0;
    }
    if (newSpeedIndex !== playbackRateIndex) {
        console.log("Change speed from [" + playbackSpeeds[playbackRateIndex] + "] -> [" + playbackSpeeds[newSpeedIndex] + "]");
        playerObj.setPlaybackRate(playbackSpeeds[newSpeedIndex]);
    }
};

function fastfwd() {
    var newSpeedIndex = playbackRateIndex + 1;
    if (newSpeedIndex >= playbackSpeeds.length) {
        newSpeedIndex = playbackSpeeds.length - 1;
    }
    if (newSpeedIndex !== playbackRateIndex) {
        console.log("Change speed from [" + playbackSpeeds[playbackRateIndex] + "] -> [" + playbackSpeeds[newSpeedIndex] + "]");
        playerObj.setPlaybackRate(playbackSpeeds[newSpeedIndex]);
    }
};

function expandSAP(playerControls) {
    playerControls.removeFocus();
    playerControls.currentObj = playerControls.audioTracksList;
    //move focus to the first element in the top navigation bar
    playerControls.currentPos = playerControls.components.indexOf(playerControls.audioTracksList);
    playerControls.addFocus();
    playerControls.showAudioDropDown()
    console.log('expanding show audio (sap) dropdown.')
}
function expandCC(playerControls) { // for testing purposes
    playerControls.removeFocus();
    playerControls.currentObj = playerControls.ccTracksList;
    //move focus to the first element in the top navigation bar
    playerControls.currentPos = playerControls.components.indexOf(playerControls.ccTracksList);
    playerControls.addFocus();
    playerControls.showCCDropDown()
    console.log('expanding CC tracks dropdown.')
}
function expandCCStyles(playerControls) {
    playerControls.removeFocus();
    playerControls.currentObj = playerControls.ccStylesList;
    //move focus to the first element in the top navigation bar
    playerControls.currentPos = playerControls.components.indexOf(playerControls.ccStylesList);
    playerControls.addFocus();
    playerControls.showCCStyleDropDown()
    console.log('expanding CC styles dropdown.')
}
function expandVideos(playerControls) {
    playerControls.removeFocus();
    playerControls.currentObj = playerControls.videoFileList;
    //move focus to the first element in the top navigation bar
    playerControls.currentPos = playerControls.components.indexOf(playerControls.videoFileList);
    playerControls.addFocus();
    playerControls.showDropDown()
    console.log('expanding videos dropdown.')
}

//  load video file from select field
function getVideo(cache_only) {
    var fileURLContent = document.getElementById("videoURLs").value; // get select field
    if (fileURLContent != "") {
        var newFileURLContent = fileURLContent;
        document.getElementById("contentURL").innerHTML = "URL: " + fileURLContent;
        //get the selected index of the URL List
        var selectedURL = document.getElementById("videoURLs");
        var optionIndex = selectedURL.selectedIndex;
        //set the index to the selected field
        document.getElementById("videoURLs").selectedIndex = optionIndex;

        console.log(newFileURLContent);
        if(cache_only)
        {
	        for ( urlIndex = 0; urlIndex < urls.length; urlIndex++) {
	            if (newFileURLContent === urls[urlIndex].url) {
	                console.log("FOUND at index: " + urlIndex);
	                cacheStream(urls[urlIndex], (0 == urlIndex));
	                break;
	            }
	        }
        }
        else
        {
            // ADINA added a try catch since resetPlayer() was throwing the error:
            // UVEMediaPlayer.js:189 Uncaught ReferenceError: AAMPMediaPlayer is not defined
            try {
                resetPlayer();
            }
            catch(err) {
                console.warn(err)
            }
            resetUIOnNewAsset();
            for ( urlIndex = 0; urlIndex < urls.length; urlIndex++) {
                if (newFileURLContent === urls[urlIndex].url) {
                    console.log("FOUND at index: " + urlIndex);
                    // ADINA added a try catch since resetPlayer() was throwing the error:
                    // Uncaught TypeError: Cannot read properties of null (reading 'initConfig')
                    try {
                        loadUrl(urls[urlIndex], (0 == urlIndex));
                    }
                    catch(err) {
                        console.warn(err)
                    }
                    break;
                }
            }
        }
    } else {
        errMessage("Enter a valid video URL"); // fail silently
    }
}

//function to Change the Audio Track
function changeAudioTrack() {
    var audioTrackID =  document.getElementById("audioTracks").value; // get selected Audio track
    //ADINA changed to try catch so as not to error out if no tracks
    try {
        playerObj.setAudioTrack(Number(audioTrackID));
        console.log("Setting Audio track: " + audioTrackID);
    }
    catch(err) {
        console.log("Couldn't set audio track because there are none.")
    }
}

//function to Change the Closed Captioning Track
function changeCCTrack() {
    if (ccStatus === true) {
        //if CC is enabled
        var trackID =  document.getElementById("ccTracks").value; // get selected cc track
        if(enableNativeCC) {
            //Find trackIndex of CC track with language
            let tracks = JSON.parse(playerObj.getAvailableTextTracks());
            let trackIdx = tracks.findIndex(tr => { return tr.type === "CLOSED-CAPTIONS" && tr.language === trackID; })
            console.log("Found trackIdx: " + trackIdx);
            playerObj.setTextTrack(trackIdx);
        } else {
            XREReceiver.onEvent("onClosedCaptions", { setTrack: trackID });
        }
    }
}

//function to Change the Closed Captioning Style Options
function changeCCStyle() {
    var styleOption =  document.getElementById("ccStyles").selectedIndex; // get selected cc track
    if ((enableNativeCC) && (ccStatus === true)) {
        //if CC is enabled
        switch(styleOption) {
            case 0:
                    playerObj.setTextStyleOptions(JSON.stringify(ccOptions));
                    break;
            case 1:
                    playerObj.setTextStyleOptions(JSON.stringify(ccOptions1));
                    break;
            case 2:
                    playerObj.setTextStyleOptions(JSON.stringify(ccOptions2));
                    break;
        }
        console.log("Current closed caption style is :" + playerObj.getTextStyleOptions());
    } else if((!enableNativeCC) && (ccStatus === true)) {
        switch(styleOption) {
            case 0:
                    XREReceiver.onEvent("onClosedCaptions", { setOptions: xreCCOptions});
                    break;
            case 1:
                    XREReceiver.onEvent("onClosedCaptions", { setOptions: xreCCOptions1});
                    break;
            case 2:
                    XREReceiver.onEvent("onClosedCaptions", { setOptions: xreCCOptions2});
                    break;
        }
    }
}

//function to jump to user entered position
function jumpToPPosition() {
    if(document.getElementById("jumpPosition").value) {
        var position = Number(document.getElementById("jumpPosition").value)/1000;
        if (!isNaN(position)) {
            if(document.getElementById("seekCheck").checked) {
                // call old seek API
                playerObj.seek(position);
            } else {
                // call new seek API with support to seek with pause
                playerObj.pause();
                playerObj.seek(position, true);
            }
        }
        document.getElementById("jumpPosition").value = "";
    }
}

//function to toggle Overlay widget
function toggleOverlay() {
    var overlay = document.getElementById('overlayModal');
    var urlMod = document.getElementById('urlModal');
    document.getElementById("logCheck").checked = !document.getElementById("logCheck").checked;
    if(document.getElementById("logCheck").checked) {
        overlay.style.display = "block";
        urlMod.style.display = "block";
    } else {
        overlay.style.display = "none";
        urlMod.style.display = "none";
    }
}


//function to toggle Metadata widget
function toggleTimedMetadata() {
    var metadataMod = document.getElementById('metadataModal');
    var positionMod = document.getElementById('positionModal');
    document.getElementById("metadataCheck").checked = !document.getElementById("metadataCheck").checked;
    if(document.getElementById("metadataCheck").checked) {
        metadataMod.style.display = "block";
        positionMod.style.display = "block";
    } else {
        metadataMod.style.display = "none";
        positionMod.style.display = "none";
    }
}

function loadNextAsset() {
    resetPlayer();
    resetUIOnNewAsset();
    urlIndex++;
    if (urlIndex >= urls.length) {
        urlIndex = 0;
    }
    loadUrl(urls[urlIndex], (0 == urlIndex));
}

function cacheNextAsset() {
    urlIndex++;
    if (urlIndex >= urls.length) {
        urlIndex = 0;
    }
    cacheStream(urls[urlIndex], (0 == urlIndex));
}

function loadPrevAsset() {
    resetPlayer();
    resetUIOnNewAsset();
    urlIndex--;
    if (urlIndex < 0) {
        urlIndex = urls.length - 1;
    }
    loadUrl(urls[urlIndex], (0 == urlIndex));
}

var HTML5PlayerControls = function() {
    var that = this;
    this.init = function() {
        this.video = document.getElementById("video");

        // Buttons
        this.videoToggleButton = document.getElementById("videoToggleButton");
        this.playButton = document.getElementById("playOrPauseButton");
        this.rwdButton = document.getElementById("rewindButton");
        this.skipBwdButton = document.getElementById("skipBackwardButton");
        this.skipFwdButton = document.getElementById("skipForwardButton");
        this.fwdButton = document.getElementById("fastForwardButton");
        this.muteButton = document.getElementById("muteVideoButton");
        this.ccButton = document.getElementById("ccButton");
        this.autoVideoLogButton = document.getElementById("autoLogButton");
        this.autoSeekButton = document.getElementById("autoSeekButton");
        this.jumpButton = document.getElementById("jumpButton");
        this.metadataLogButton = document.getElementById("metadataButton");
        this.homeContentButton = document.getElementById('homeButton');

        // Sliders
        this.seekBar = document.getElementById("seekBar");
        this.cacheOnlyButton = document.getElementById("cacheOnlyButton");
        this.videoFileList = document.getElementById("videoURLs");
        this.audioTracksList = document.getElementById("audioTracks");
        this.ccTracksList = document.getElementById("ccTracks");
        this.ccStylesList = document.getElementById("ccStyles");
        this.jumpPositionInput = document.getElementById("jumpPosition");

        // X1 SELECTION PICKER
        this.x1_selection_picker = document.getElementById("x1_selection_picker")
        //X1 GUIDE
        this.x1_guide = document.getElementById("x1_guide")
        //X1 ENTITY PAGE
        this.x1_entity_page = document.getElementById("x1_entity_page")
/* 
        this.currentObj = this.playButton;
        this.components = [
            this.playButton,            //0
            this.videoToggleButton,     //1
            this.rwdButton,             //2
            this.skipBwdButton,         //3
            this.skipFwdButton,         //4
            this.fwdButton,             //5
            this.muteButton,            //6
            this.ccButton,              //7
            this.audioTracksList,       //8
            this.ccTracksList,          //9
            this.ccStylesList,          //10
            this.cacheOnlyButton,       //11
            this.videoFileList,         //12
            this.autoSeekButton,        //13
            this.jumpPositionInput,     //14
            this.jumpButton,            //15
            this.autoVideoLogButton,    //16
            this.metadataLogButton,     //17
            this.homeContentButton      //18
        ];
        this.currentPos = 0;
 */

        /* start ADINA ADDITIONS */
        // Buttons
        this.sapExpander = document.getElementById("sapExpander")
        this.ccExpander = document.getElementById("ccExpander")
        this.ccStylesExpander = document.getElementById("ccStylesExpander")
        //

        this.currentObj = this.playButton
        this.components = [
            this.sapExpander,       //0
            this.ccButton,          //1
            this.rwdButton,         //2
            this.playButton,        //3
            this.fwdButton,         //4
            this.ccExpander,        //5
            this.ccStylesExpander,  //6
            this.audioTracksList,   //7
            this.ccTracksList,      //8
            this.ccStylesList,      //9
            this.videoFileList      //10
        ]
        //this.currentPos = 3
        this.currentPos = this.components.indexOf(this.playButton);
        /* end ADINA ADDITIONS */

        this.dropDownListVisible = false;
        this.audioListVisible = false;
        this.ccListVisible = false;
        this.ccStyleListVisible = false;
        this.guideVisible = false;  // ADINA added for entity page
        this.entityVisible = false;  // ADINA added for entity page
        this.selectListIndex = 0;
        this.selectAudioListIndex = 0;
        this.selectCCListIndex = 0;
        this.selectCCStyleListIndex = 0;
        this.prevObj = null;
        this.addFocus();
        this.seekBar.style.backgroundColor = "red";

        document.getElementById('ffModal').style.display = "none";
        document.getElementById('ffSpeed').style.display = "none";

        // Event listener for the play/pause button
        this.playButton.addEventListener("click", function() {
            playPause();
        });

        // Event listener for the home button
        this.homeContentButton.addEventListener("click", function() {
            goToHome();
        });

        // Event listener for the mute button
        this.muteButton.addEventListener("click", function() {
            mutePlayer();
        });

        // Event listener for the cc toggle button
        this.ccButton.addEventListener("click", function() {
            toggleCC();
        });

        // Event listener for the rewind button
        this.rwdButton.addEventListener("click", function() {
            fastrwd();
        });

        // Event listener for the skip Backward button
        this.skipBwdButton.addEventListener("click", function() {
            skipBackward();
        });

        // Event listener for the skip Forward button
        this.skipFwdButton.addEventListener("click", function() {
            skipForward();
        });

        // Event listener for the fast Forward button
        this.fwdButton.addEventListener("click", function() {
            fastfwd();
        });

        // start ADINA CHANGES
        this.sapExpander.addEventListener("click", function() {
            expandSAP()
        })
        this.ccExpander.addEventListener("click", function() {
            // expandCCStyles() // use the styles dropdown for testing on PC
            expandCC()
        })
        this.ccStylesExpander.addEventListener("click", function() {
            // expandCCStyles() // use the styles dropdown for testing on PC
            expandCCStyles()
        })

        // end ADINA CHANGES

        this.seekBar.addEventListener("change", function() {
            // Calculate the new time
            var duration = playerObj.getDurationSec();
            var time = duration * (seekBar.value / 100);
            console.log("seek cursor time: " + time);
            playerObj.seek(time);
        });

        // Pause the video when the seek handle is being dragged
        this.seekBar.addEventListener("keydown", function() {
            playerObj.pause();
        });

        // Play the video when the seek handle is dropped
        this.seekBar.addEventListener("keyup", function() {
            playerObj.play();
        });
    };

    this.reset = function() {

        var value = 0;
        this.playButton.src = "../icons/play.png";
        this.seekBar.value = value;
        this.seekBar.style.width = value+"%";
    };

    this.keyLeft = function() {
        this.gotoPrevious();
    };

    this.keyRight = function() {
        this.gotoNext();
    };

    this.keyUp = function() {
        if ((this.components[this.currentPos] == this.audioTracksList) && (this.audioListVisible)) {
            this.prevAudioSelect();
        } else if ((this.components[this.currentPos] == this.videoFileList) && (this.dropDownListVisible)) {
            this.prevVideoSelect();
        } else if ((this.components[this.currentPos] == this.ccTracksList) && (this.ccListVisible)) {
            this.prevCCSelect();
        } else if ((this.components[this.currentPos] == this.ccStylesList) && (this.ccStyleListVisible)) {
            this.prevCCStyleSelect();
        } else if ((this.components[this.currentPos] == this.playButton) || (this.components[this.currentPos] == this.videoToggleButton) || (this.components[this.currentPos] == this.rwdButton) || (this.components[this.currentPos] == this.skipBwdButton) || (this.components[this.currentPos] == this.skipFwdButton) || (this.components[this.currentPos] == this.fwdButton) || (this.components[this.currentPos] == this.muteButton) || (this.components[this.currentPos] == this.ccButton) || (this.components[this.currentPos] == this.ccExpander) || (this.components[this.currentPos] == this.ccStylesExpander) || (this.components[this.currentPos] == this.sapExpander)) {
            //when a keyUp is received from the buttons in the bottom navigation bar
            this.removeFocus();
            this.currentObj = this.audioTracksList;
            //move focus to the first element in the top navigation bar
            this.currentPos = this.components.indexOf(this.audioTracksList);
            this.addFocus();
        }
    };

    this.keyDown = function() {
        if ((this.components[this.currentPos] == this.audioTracksList) && (this.audioListVisible)) {
            this.nextAudioSelect();
        } else if ((this.components[this.currentPos] == this.videoFileList) && (this.dropDownListVisible)) {
            this.nextVideoSelect();
        } else if ((this.components[this.currentPos] == this.ccTracksList) && (this.ccListVisible)) {
            this.nextCCSelect();
        } else if ((this.components[this.currentPos] == this.ccStylesList) && (this.ccStyleListVisible)) {
            this.nextCCStyleSelect();
        } else if ((this.components[this.currentPos] == this.audioTracksList) || (this.components[this.currentPos] == this.ccTracksList) || (this.components[this.currentPos] == this.ccStylesList) || (this.components[this.currentPos] == this.videoFileList) || (this.components[this.currentPos] == this.cacheOnlyButton) || (this.components[this.currentPos] == this.autoSeekButton) || (this.components[this.currentPos] == this.jumpPositionInput) || (this.components[this.currentPos] == this.jumpButton) || (this.components[this.currentPos] == this.autoVideoLogButton) || (this.components[this.currentPos] == this.metadataLogButton) || (this.components[this.currentPos] == this.homeContentButton)) {
            //when a keyDown is received from the buttons in the top navigation bar
            this.removeFocus();
            this.currentObj = this.playButton;
            //move focus to the first element in the bottom navigation bar
            //this.currentPos = 0;
            this.currentPos = this.components.indexOf(this.playButton);
            this.addFocus();
        }
    };

    this.prevVideoSelect = function() {
        if (this.selectListIndex > 0) {
            this.selectListIndex--;
        } else {
            this.selectListIndex = this.videoFileList.options.length - 1;
        }
        this.videoFileList.options[this.selectListIndex].selected = true;
        this.changeX1GuideSelectionStatus(this.selectListIndex)
    };

    this.nextVideoSelect = function() {
        if (this.selectListIndex < this.videoFileList.options.length - 1) {
            this.selectListIndex++;
        } else {
            this.selectListIndex = 0;
        }
        this.videoFileList.options[this.selectListIndex].selected = true;
        this.changeX1GuideSelectionStatus(this.selectListIndex)
    };

    this.prevAudioSelect = function() {
        if (this.selectAudioListIndex > 0) {
            this.selectAudioListIndex--;
        } else {
            this.selectAudioListIndex = this.audioTracksList.options.length - 1;
        }
        this.audioTracksList.options[this.selectAudioListIndex].selected = true;
        this.changeX1SelectionStatus(this.selectAudioListIndex)
    };

    this.nextAudioSelect = function() {
        if (this.selectAudioListIndex < this.audioTracksList.options.length - 1) {
            this.selectAudioListIndex++;
        } else {
            this.selectAudioListIndex = 0;
        }
        this.audioTracksList.options[this.selectAudioListIndex].selected = true;
        this.changeX1SelectionStatus(this.selectAudioListIndex)
    };

    this.prevCCSelect = function() {
        if (this.selectCCListIndex > 0) {
            this.selectCCListIndex--;
        } else {
            this.selectCCListIndex = this.ccTracksList.options.length - 1;
        }
        this.ccTracksList.options[this.selectCCListIndex].selected = true;
        this.changeX1SelectionStatus(this.selectCCListIndex)
    };

    this.nextCCSelect = function() {
        if (this.selectCCListIndex < this.ccTracksList.options.length - 1) {
            this.selectCCListIndex++;
        } else {
            this.selectCCListIndex = 0;
        }
        this.ccTracksList.options[this.selectCCListIndex].selected = true;
        this.changeX1SelectionStatus(this.selectCCListIndex)
    };

    this.prevCCStyleSelect = function() {
        if (this.selectCCStyleListIndex > 0) {
            this.selectCCStyleListIndex--;
        } else {
            this.selectCCStyleListIndex = this.ccStylesList.options.length - 1;
        }
        this.ccStylesList.options[this.selectCCStyleListIndex].selected = true;
        this.changeX1SelectionStatus(this.selectCCStyleListIndex)
    };

    this.nextCCStyleSelect = function() {
        if (this.selectCCStyleListIndex < this.ccStylesList.options.length - 1) {
            this.selectCCStyleListIndex++;
        } else {
            this.selectCCStyleListIndex = 0;
        }
        this.ccStylesList.options[this.selectCCStyleListIndex].selected = true;
        this.changeX1SelectionStatus(this.selectCCStyleListIndex)
    };

    // start ADINA EDITS
    this.changeX1SelectionStatus = function(index) {
        this.x1_selection_picker.querySelector('.selected').classList.remove('selected')
        this.x1_selection_picker.querySelectorAll('div')[index].classList.add('selected')
    }

    this.changeX1GuideSelectionStatus = function(index) {
        this.x1_guide.querySelector('.selected').classList.remove('selected')
        this.x1_guide.querySelectorAll('.guide_row')[index + 1].querySelectorAll('.guide_cell')[1].classList.add('selected')
    }
    // end ADINA EDITS

    this.showDropDown = function() {
        this.dropDownListVisible = true;
        var n = this.videoFileList.options.length;
        this.videoFileList.size = n;
        this.showX1Guide(this.videoFileList, this.selectListIndex)
    };

    this.hideDropDown = function() {
        this.dropDownListVisible = false;
        this.videoFileList.size = 1;
        this.hideX1Guide()
    };

    this.showAudioDropDown = function() {
        this.audioListVisible = true;
        var n = this.audioTracksList.options.length;
        this.audioTracksList.size = n;
        this.showX1SelectionPicker(this.audioTracksList, this.selectAudioListIndex)
    };

    this.hideAudioDropDown = function() {
        this.audioListVisible = false;
        this.audioTracksList.size = 1;
        this.hideX1SelectionPicker()
    };

    
    this.showCCDropDown = function() {
        this.ccListVisible = true;
        var n = this.ccTracksList.options.length;
        this.ccTracksList.size = n;
        this.showX1SelectionPicker(this.ccTracksList, this.selectCCListIndex)
    };

    this.hideCCDropDown = function() {
        this.ccListVisible = false;
        this.ccTracksList.size = 1;
        this.hideX1SelectionPicker()
    };

    this.showCCStyleDropDown = function() {
        this.ccStyleListVisible = true;
        var n = this.ccStylesList.options.length;
        this.ccStylesList.size = n;
        this.showX1SelectionPicker(this.ccStylesList, this.selectCCStyleListIndex)
    };

    this.hideCCStyleDropDown = function() {
        this.ccStyleListVisible = false;
        this.ccStylesList.size = 1;
        this.hideX1SelectionPicker()
    };

    this.showEntity = function() {

    }

    this.hideEntity = function() {

    }

    this.showX1Guide = function(list, index) {
        //abort if no options
        if (list.options.length == 0) {
            console.log('no options')
            return false
        }
        // build list of grid rows (these rows include the top header grid row)
        let guide_rows = this.x1_guide.querySelectorAll('.guide_row')

        // populate grid cells with options
        let j = 1
        for (const op of list.options) {
            guide_rows[j].querySelectorAll('.guide_cell')[1].textContent = op.textContent
            j += 1
        }
        // mark selected option
        guide_rows[index + 1].querySelectorAll('.guide_cell')[1].classList.add('selected')

        // show X1 Guide
        this.x1_guide.classList.remove('hidden')
        this.guideVisible = true
    }

    this.hideX1Guide = function() {
        this.x1_guide.classList.add('hidden')

        // remove .selected from .grid_cells
        this.x1_guide.querySelector('.selected').classList.remove('selected')

        this.guideVisible = false
    }

    this.showX1SelectionPicker = function(list, index) {
        //abort if no options
        if (list.options.length == 0) {
            console.log('no options')
            return false
        }
        // clear old options
        this.x1_selection_picker.innerHTML = ""
        // populate new options
        for (const op of list.options) {
            let op_div = document.createElement('div')
            op_div.textContent = op.textContent
            this.x1_selection_picker.append(op_div)
        }
        // mark selected option
        let ops = this.x1_selection_picker.querySelectorAll('div')
        ops[index].classList.add('selected')
        // show X1 Selection Picker
        this.x1_selection_picker.classList.remove('hidden')
    }

    this.hideX1SelectionPicker = function() {
        this.x1_selection_picker.classList.add('hidden')
    }

/*     this.ok = function() {
        switch (this.currentPos) {
            case 0:
                    playPause();
                    break;
            case 1:
                    toggleVideo();
                    break;
            case 2:
                    fastrwd();
                    break;
            case 3:
                    skipBackward();
                    break;
            case 4:
                    skipForward();
                    break;
            case 5:
                    fastfwd();
                    break;
            case 6:
                    mutePlayer();
                    break;
            case 7:
                    toggleCC();
                    break;
            case 8:
                    if (this.audioListVisible == false) {
                        this.showAudioDropDown();
                    } else {
                        this.hideAudioDropDown();
                        changeAudioTrack();
                    }
                    break;
            case 9:
                    if (this.ccListVisible == false) {
                        this.showCCDropDown();
                    } else {
                        this.hideCCDropDown();
                        changeCCTrack();
                    }
                    break;
            case 10:
                    if (this.ccStyleListVisible == false) {
                        this.showCCStyleDropDown();
                    } else {
                        this.hideCCStyleDropDown();
                        changeCCStyle();
                    }
                    break;
            case 11:
                    //Cache Only check box
                    document.getElementById("cacheOnlyCheck").checked = !document.getElementById("cacheOnlyCheck").checked;
                    break;
            case 12:
                    if (this.dropDownListVisible == false) {
                        this.showDropDown();
                    } else {
                        this.hideDropDown();
                        getVideo(document.getElementById("cacheOnlyCheck").checked);
                    }
                    break;
            case 13:
                    document.getElementById("seekCheck").checked = !document.getElementById("seekCheck").checked;
                    break;
            case 15:
                    jumpToPPosition();
                    break;
            case 16:
                    toggleOverlay();
                    break;
            case 17:
                    toggleTimedMetadata();
                    break;
            case 18:
                    goToHome();
                    break;
            };
    }; */

    // start ADINA CHANGES
    this.ok = function() {
        switch (this.currentPos) {
            case 0:
                expandSAP(this)
                break
            case 1:
                toggleCC()
                break
            case 2:
                fastrwd()
                break
            case 3:
                playPause();
                break;
            case 4:
                fastfwd();
                break;
            case 5:
                expandCC(this)
                break
            case 6:
                expandCCStyles(this)
                break
            case 7:
                if (this.audioListVisible == false) {
                    this.showAudioDropDown();
                } else {
                    this.hideAudioDropDown();
                    changeAudioTrack();
                    // start ADINA CHANGES
                    // go back to the SAP button:
                    this.removeFocus();
                    this.currentObj = this.sapExpander;
                    this.currentPos = this.components.indexOf(this.sapExpander);
                    this.addFocus();
                    console.log('closing sap list')
                    // end ADINA CHANGES
                }
                break;
            case 8:
                if (this.ccListVisible == false) {
                    this.showCCDropDown();
                } else {
                    this.hideCCDropDown();
                    changeCCTrack();
                    // start ADINA CHANGES
                    // go back to the CC button:
                    this.removeFocus();
                    this.currentObj = this.ccExpander;
                    this.currentPos = this.components.indexOf(this.ccExpander);
                    this.addFocus();
                    console.log('closing cc list')
                    // end ADINA CHANGES
                }
                break;
            case 9:  // USING CC STYLE LIST FOR TESTING
                if (this.ccStyleListVisible == false) {
                    this.showCCStyleDropDown();
                } else {
                    this.hideCCStyleDropDown();
                    changeCCStyle();
                    // start ADINA CHANGES
                    // go back to the CC button:
                    this.removeFocus();
                    this.currentObj = this.ccStylesExpander;
                    this.currentPos = this.components.indexOf(this.ccStylesExpander);
                    this.addFocus();
                    console.log('closing cc styles list')
                    // end ADINA CHANGES
                }
                break;
            case 10:
                if (this.dropDownListVisible == false) {
                    this.showDropDown();
                } else {
                    this.hideDropDown();
                    getVideo(document.getElementById("cacheOnlyCheck").checked);
                    // start ADINA CHANGES
                    // go back to the CC button:
                    this.removeFocus();
                    this.currentObj = this.playButton;
                    this.currentPos = this.components.indexOf(this.playButton);
                    this.addFocus();
                    console.log('closing videos list')
                    //play the video you selected
                    playPause();
                    // end ADINA CHANGES
                }
                break;
            };
    };

    this.last = function() {
        if ((this.dropDownListVisible) || (this.audioListVisible) || (this.ccListVisible) || (this.ccStyleListVisible) || (this.entityVisible)) {
            switch (true) {
                case this.dropDownListVisible:
                    this.hideDropDown()
                    break
                case this.audioListVisible:
                    this.hideAudioDropDown()
                    break
                case this.ccListVisible:
                    this.hideCCDropDown()
                    break
                case this.ccStyleListVisible:
                    this.hideCCStyleDropDown()
                    break
                case this.entityVisible:
                    this.hideEntity()
                    break
            }
            this.removeFocus();
            this.currentObj = this.playButton;
            this.currentPos = this.components.indexOf(this.playButton);
            this.addFocus();
            console.log('go back to video player')
        }
    }

    this.guide = function() {
        if (this.dropDownListVisible == false) {
            this.showDropDown();
        }
    }
    // end ADINA CHANGES

    this.gotoNext = function() {
        this.removeFocus();
        if (this.currentPos < this.components.length - 1) {
            this.currentPos++;
        } else {
            //this.currentPos = 0;
            this.currentPos = this.components.indexOf(this.playButton);
        }
        this.currentObj = this.components[this.currentPos];
        this.addFocus();
    };

    this.gotoPrevious = function() {
        this.removeFocus();
        if (this.currentPos > 0) {
            this.currentPos--;
        } else {
            this.currentPos = this.components.length - 1;
        }
        this.currentObj = this.components[this.currentPos];
        this.addFocus();
    };

    this.addFocus = function() {
        if (this.currentObj) {
            this.currentObj.classList.add("focus");
        } else {
            this.currentObj.focus();
        }
    };

    this.removeFocus = function() {
        if (this.currentObj) {
            this.currentObj.classList.remove("focus");
        } else {
            this.currentObj.blur();
        }
    };

    this.keyEventHandler = function(e, type) {
        var keyCode = e.which || e.keyCode;
        console.log("UVE Pressed keycode" + keyCode);
        e.preventDefault();
        if (type == "keydown") {
            switch (keyCode) {
                case 37: // Left Arrow
                        this.keyLeft();
                        break;
                case 38: // Up Arrow
                        this.keyUp();
                        break;
                case 39: // Right Arrow
                        this.keyRight();
                        break;
                case 40: // Down Arrow
                        this.keyDown();
                        break;
                case 13: // Enter
                        if(disableButtons) {
                            // If playback error modal is ON, hide it on clicking 'OK'
                            this.dismissModalDialog();
                        } else {
                            this.ok();
                        }
                        break;
                case 88: // X
		        case 34:
                        skipBackward();
                        break;
                case 90: // Z
		        case 33:
                        skipForward();
                        break;
                case 32:
                        if(disableButtons) {
                            // If playback error modal is ON, hide it on clicking 'OK'
                            this.dismissModalDialog();
                        } else {
                            this.ok();
                        }
                        break;
                case 73: // Info.  I (keyboard)
                        if (this.dropDownListVisible == false) {
                            expandVideos(this)
                            //move focus to play
                        }
                        break
                case 8: // Last.  Del or Backspace (keyboard)
                        this.last() // ADINA TBD: what 
                        break
		        case 179:
                case 80: // P
                        playPause();
                        break;
                case 113: // F2
                        mutePlayer();
                        break;
                case 82: // R
		        case 227:
                        fastrwd();
                        break;
                case 70: // F
		        case 228:
                        fastfwd();
                        break;
                case 117: // F6
                        overlayController();
                        break;
                case 85: // U
                        loadNextAsset();
                        break;
                case 68: // D
                        loadPrevAsset();
                        break;
                case 48: // Number 0
                case 49: // Number 1
                case 50: // Number 2
                case 51: // Number 3
                case 52: // Number 4
                case 53: // Number 5
                case 54: // Number 6
                case 55: // Number 7
                case 56: // Number 8
                case 57: // Number 9
                         // If keypress is for input to the progress position field
                         if((this.currentObj === this.jumpPositionInput) && !disableButtons) {
                             document.getElementById("jumpPosition").value =  document.getElementById("jumpPosition").value + String(e.key);
                         }
                         break;
                default:
                        break;
            }
        }
        // Get current Object ID
        currentObjID = this.currentObj.id;
        return false;
    }

    this.dismissModalDialog = function() {
        //If clicked OK on overlay modal hide it
        document.getElementById('errorModal').style.display = "none";
        this.currentObj = this.videoFileList;
        // Move focus to the video url list
        this.currentPos = this.components.indexOf(this.videoFileList);
        this.addFocus();
        disableButtons = false;
    }
};

// Function to change the opacity of the buttons
function changeButtonOpacity(opacity) {
    document.getElementById('jumpPosition').style.opacity = opacity;
    document.getElementById('jumpButton').style.opacity = opacity;
    document.getElementById('playOrPauseButton').style.opacity = opacity;
    document.getElementById('videoToggleButton').style.opacity = opacity;
    document.getElementById('rewindButton').style.opacity = opacity;
    document.getElementById('skipBackwardButton').style.opacity = opacity;
    document.getElementById('skipForwardButton').style.opacity = opacity;
    document.getElementById('fastForwardButton').style.opacity = opacity;
    document.getElementById('muteVideoButton').style.opacity = opacity;
    document.getElementById('ccButton').style.opacity = opacity;
    document.getElementById('ccTracks').style.opacity = opacity;
    document.getElementById('ccStyles').style.opacity = opacity;
    document.getElementById('cacheOnlyButton').style.opacity = opacity;
    document.getElementById('autoSeekButton').style.opacity = opacity;
    document.getElementById('autoLogButton').style.opacity = opacity;
    document.getElementById('metadataButton').style.opacity = opacity;
    document.getElementById('homeButton').style.opacity = opacity;
}

function overlayController() {
    var navBar = document.getElementById('controlDiv');
    var navBarNext = document.getElementById('controlDivNext');
    // Get the modal
    if(navBar.style.display == "block") {
        navBar.style.display = "none";
    } else {
        navBar.style.display = "block";
    }
    if(navBarNext.style.display == "block") {
        navBarNext.style.display = "none";
    } else {
        navBarNext.style.display = "block";
    }
};

function createBitrateList(availableBitrates) {
    bitrateList = [];
    for (var iter = 0; iter < availableBitrates.length; iter++) {
        bitrate = (availableBitrates[iter] / 1000000).toFixed(1);
        bitrateList.push(bitrate);
    }
    document.getElementById("availableBitratesList").innerHTML = bitrateList;
};

function showTrickmodeOverlay(speed) {
    document.getElementById('ffSpeed').innerHTML = Math.abs(speed)+ "x";
    if (speed > 0) {
        document.getElementById('ffModal').style["-webkit-transform"]= "scaleX(1)";
    } else {
        document.getElementById('ffModal').style["-webkit-transform"]= "scaleX(-1)";
    }

    //Display Fast Forward modal
    document.getElementById('ffModal').style.display = "block";
    document.getElementById('ffSpeed').style.display = "block";

    //Set timeout to hide
    setTimeout(function() {
        document.getElementById('ffModal').style.display = "none";
        document.getElementById('ffSpeed').style.display = "none";
    }, 2000);
};

// Convert seconds to hours
function convertSStoHr(videoTime) {
    var hhTime = Math.floor(videoTime / 3600);
    var mmTime = Math.floor((videoTime - (hhTime * 3600)) / 60);
    var ssTime = videoTime - (hhTime * 3600) - (mmTime * 60);
    ssTime = Math.round(ssTime);

    var timeFormat = (hhTime < 10 ? "0" + hhTime : hhTime);
        timeFormat += ":" + (mmTime < 10 ? "0" + mmTime : mmTime);
        timeFormat += ":" + (ssTime  < 10 ? "0" + ssTime : ssTime);

    return timeFormat;
};


function resetUIOnNewAsset(){
    controlObj.reset();
    document.getElementById("muteIcon").src = "../icons/unMute.png";
    document.getElementById("currentDuration").innerHTML = "00:00:00";
    document.getElementById("positionInSeconds").innerHTML = "0s";
    document.getElementById("totalDuration").innerHTML = "00:00:00";
    document.getElementById('ffSpeed').innerHTML = "";
    document.getElementById('ffModal').style.display = "none";
    document.getElementById('ffSpeed').style.display = "none";
    document.getElementById("jumpPosition").value = "";
    document.getElementById("metadataContent").innerHTML = "";
};

function initPlayerControls() {

    controlObj = new HTML5PlayerControls();
    controlObj.init();
    if (document.addEventListener) {
        document.addEventListener("keydown", function(e) {
            return controlObj.keyEventHandler(e, "keydown");
        });
    }

    //to show the navBar initially
    document.getElementById('controlDiv').style.display = "block";
    document.getElementById('controlDivNext').style.display = "block";

    //to hide the anomaly overlay widget initially
    document.getElementById("logCheck").checked = false;

    //to load URL select field
	if(urls) {
        // Iteratively adding all the options to videoURLs
        for (var iter = 0; iter < urls.length; iter++) {
            var option = document.createElement("option");
            option.value = urls[iter].url;
            option.text = urls[iter].name;
            videoURLs.add(option);
        }
        // ADINA TO DO: ADD OPTIONS TO GRAPHICAL VERSION OF OPTIONS
    }
};
