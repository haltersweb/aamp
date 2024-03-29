#!/bin/bash

# audio generation requires following installs:
#Support functions
mac_find_or_install_pkgs() {
    # Check if brew package $1 is installed
    # http://stackoverflow.com/a/20802425/1573477
    for pkg in "$@";
    do
        if brew ls --versions $pkg > /dev/null; then
            echo "${pkg} is already installed."
            arr_install_status+=("${pkg} is already installed.")
        else
            echo "Installing ${pkg}"
            brew install $pkg
            #update summery
            if brew ls --versions $pkg > /dev/null; then
                #The package is successfully installed
                arr_install_status+=("The package was ${pkg} was successfully installed.")

            else
                #The package is failed to be installed
                arr_install_status+=("The package ${pkg} was FAILED to be installed.")
            fi
        fi
    done
}

linux_find_or_install_pkgs() {

        for pkg in "$@";
        do
            if which $pkg > /dev/null; then
                echo "${pkg} already installed."
            else
                echo "Installing ${pkg}"
                sudo apt -y install $pkg
                if which $pkg > /dev/null; then
                        echo "${pkg} successfully installed."
                else
                        echo "FYI:${pkg} install failed!"
                fi
            fi

        done

}

#check and install basic packages
if [[ "$OSTYPE" == "darwin"* ]]; then
    mac_find_or_install_pkgs python ffmpeg
elif [[ "$OSTYPE" == "linux"* ]]; then
    linux_find_or_install_pkgs python3 python3-pip ffmpeg
fi

# pip3 install gtts
if which gtts-cli > /dev/null; then
   echo "gtts already installed."
else
   echo "Installing gtts, as its not available"
   pip3 install gtts
   if which gtts-cli > /dev/null; then
      echo "gtts successfully installed."
   else
      echo "FYI:gtts install failed!"
   fi
fi

WIDTH=(640 842 1280 1920)
HEIGHT=(360 480 720 1080)
KBPS=(800 1400 2800 5000)
MAXKBPS=(856 1498 2996 5350)
# recreation of main DASH manifest is not supported yet
# do it manually by merging all *.mpd files into one main.mpd
VIDEO_LENGTH_SEC=900 # multiples of 10 sec to fit audio
FPS=25 
VIDEO_SEGMENT_SEC=2
IFRAME_CADENCE_SEC=1

HLS_OUT="hls"
DASH_OUT="dash"

mkdir $HLS_OUT
mkdir $DASH_OUT

# convert single image to video; "t" is target duration in seconds
FILE_LOOP=loop.mp4
if [ -f "$FILE_LOOP" ]; then
	echo "$FILE_LOOP exists"
else
	ffmpeg -loop 1 -i testpat.jpg -c:v libx264 -t $VIDEO_LENGTH_SEC -pix_fmt yuv420p -vf scale=1920:1080 -r $FPS $FILE_LOOP
fi

# generate profiles
for I in {0..3} 
do
# add resolution and current-time as overlay
FILE_OVERLAY=overlay${HEIGHT[$I]}.mp4
if [ -f "$FILE_OVERLAY" ]; then
	echo "$FILE_OVERLAY exists"
else
ffmpeg -i loop.mp4 -vf \
drawtext="fontfile=/path/to/font.ttf: text='%{pts\:hms}': fontcolor=white: fontsize=48: box=1: boxcolor=black: boxborderw=5: x=(w-text_w)/2: y=(h-text_h)/2",\
drawtext="fontfile=/path/to/font.ttf: text='${HEIGHT[$I]}p': fontcolor=white: fontsize=48: box=1: boxcolor=black: boxborderw=5: x=(w-text_w)/2: y=(h/2-text_h)/2" \
-codec:a copy $FILE_OVERLAY
fi

# Generate DASH content with HLS manifest
ffmpeg -hide_banner -y -i overlay${HEIGHT[$I]}.mp4 -map 0:v  -vf scale=w=${WIDTH[$I]}:h=${HEIGHT[$I]}:force_original_aspect_ratio=decrease  -c:v h264 -profile:v main -crf 20 -sc_threshold 0 -g $((FPS*VIDEO_SEGMENT_SEC)) -b:v ${KBPS[$I]}k -maxrate ${MAXKBPS[$I]}k -bufsize 1200k -hls_segment_type fmp4  -hls_time $VIDEO_SEGMENT_SEC -hls_playlist_type vod -hls_segment_filename $DASH_OUT/${HEIGHT[$I]}p_'%03d.m4s' -hls_fmp4_init_filename ${HEIGHT[$I]}p_init.m4s -start_number 1  $DASH_OUT/${HEIGHT[$I]}p.m3u8

# Override DASH video with the same content and generate DASH manifest
ffmpeg -hide_banner -y -i overlay${HEIGHT[$I]}.mp4 -map 0:v  -vf scale=w=${WIDTH[$I]}:h=${HEIGHT[$I]}:force_original_aspect_ratio=decrease  -c:v h264 -profile:v main -crf 20 -sc_threshold 0 -g $((FPS*VIDEO_SEGMENT_SEC)) -b:v ${KBPS[$I]}k -maxrate ${MAXKBPS[$I]}k -bufsize 1200k -seg_duration $((VIDEO_SEGMENT_SEC)) -use_timeline 1 -use_template 1 -init_seg_name $DASH_OUT/${HEIGHT[$I]}p_init.m4s -media_seg_name $DASH_OUT/${HEIGHT[$I]}p_'$Number%03d$.m4s'  -f dash ${HEIGHT[$I]}p.mpd

# Generate fragmented HLS
ffmpeg -hide_banner -y -i overlay${HEIGHT[$I]}.mp4 -map 0:v  -vf scale=w=${WIDTH[$I]}:h=${HEIGHT[$I]}:force_original_aspect_ratio=decrease -c:v h264 -profile:v main -crf 20 -sc_threshold 0 -g $((FPS*VIDEO_SEGMENT_SEC)) -hls_time ${VIDEO_SEGMENT_SEC} -hls_playlist_type vod  -b:v ${KBPS[$I]}k -maxrate ${MAXKBPS[$I]}k -bufsize 1200k -hls_segment_filename $HLS_OUT/${HEIGHT[$I]}p_%03d.ts $HLS_OUT/${HEIGHT[$I]}p.m3u8
done

# TODO: merge all .mpd manifests into one main.mpd
# TODO: merge all .m3u8 manifests into one main.m3u8
​
# "IFRAME" text overlay for iframe track
I=0
FILE_OVERLAY=overlayiframe.mp4
ffmpeg -y -i loop.mp4 -vf \
drawtext="fontfile=/path/to/font.ttf: text='%{pts\:hms}': fontcolor=white: fontsize=48: box=1: boxcolor=black: boxborderw=5: x=(w-text_w)/2: y=(h-text_h)/2",\
drawtext="fontfile=/path/to/font.ttf: text='IFRAME ${HEIGHT[$I]}p': fontcolor=white: fontsize=48: box=1: boxcolor=black: boxborderw=5: x=(w-text_w)/2: y=(h/2-text_h)/2" \
-codec:a copy -g $((FPS*IFRAME_CADENCE_SEC)) $FILE_OVERLAY
# single segment duration: IFRAME_CADENCE_SEC
# single segment FPS: 1/IFRAME_CADENCE_SEC
# what gives one I-Frame per segment and nothing else
# Generate iframe fragments and playlist for hls
ffmpeg -hide_banner -y -i overlayiframe.mp4 -map 0:v -vf scale=w=${WIDTH[$I]}:h=${HEIGHT[$I]}:force_original_aspect_ratio=decrease,select='eq(pict_type\,PICT_TYPE_I)' -c:v h264 -profile:v main -r $((1/IFRAME_CADENCE_SEC)) -crf 20 -sc_threshold 0 -g 1 -hls_time $IFRAME_CADENCE_SEC -hls_playlist_type vod  -b:v ${KBPS[$I]}k -maxrate ${MAXKBPS[$I]}k -bufsize 1200k -hls_segment_filename $HLS_OUT/iframe_%03d.ts  $HLS_OUT/iframe.m3u8

# Generate iframe fragments using hls fmp4 extension with HLS manifest
ffmpeg -hide_banner -y -i overlayiframe.mp4 -map 0:v -vf scale=w=${WIDTH[$I]}:h=${HEIGHT[$I]}:force_original_aspect_ratio=decrease,select='eq(pict_type\,PICT_TYPE_I)'  -c:v h264 -profile:v main -r $((1/IFRAME_CADENCE_SEC)) -crf 20 -sc_threshold 0 -g 1 -b:v ${KBPS[$I]}k -maxrate ${MAXKBPS[$I]}k -bufsize 1200k -hls_segment_type fmp4  -hls_time $IFRAME_CADENCE_SEC -hls_playlist_type vod -hls_segment_filename $DASH_OUT/iframe_'%03d.m4s' -hls_fmp4_init_filename iframe_init.m4s -start_number 1  $DASH_OUT/iframe.m3u8

# override iframe fragments with the same ones and generate DASH manifest
ffmpeg -hide_banner -y -i overlayiframe.mp4 -map 0:v -vf scale=w=${WIDTH[$I]}:h=${HEIGHT[$I]}:force_original_aspect_ratio=decrease,select='eq(pict_type\,PICT_TYPE_I)'  -c:v h264 -profile:v main -r $((1/IFRAME_CADENCE_SEC)) -crf 20 -sc_threshold 0 -g 1 -b:v ${KBPS[$I]}k -maxrate ${MAXKBPS[$I]}k -bufsize 1200k -seg_duration $((IFRAME_CADENCE_SEC)) -use_timeline 1 -use_template 1 -init_seg_name $DASH_OUT/iframe_init.m4s -media_seg_name $DASH_OUT/iframe_'$Number%03d$.m4s'  -f dash iframe.mpd

###################################################
# Generate audio tracks
###################################################

if [[ "$OSTYPE" == "linux-gnu" ]]; then
    export LC_ALL=C.UTF-8
    export LANG=C.UTF-8
fi

LANG=(en fr de es pl)
LANG_FULL_NAME=(English French German Spanish Polish)
NUMBER=(zero one two three four five six seven eight nine ten)
AUDIO_PATH='audio'
TRANSLATIONS=(English one two three four five six seven eight nine ten
    Française une deux trois quatre cinq six sept huit neuve dix
    Deutsche eins zwei drei vier fünf sechs sieben acht neun zehn
    Española una dos tres cuatro cinco seis siete ocho nueve diez
    Polskie jeden dwa trzy cztery pięć sześć siedem osiem dziewięć dziesięć)
​
for (( I=0; I<${#LANG[@]}; I++ ))
do
    echo
    echo ${LANG[$I]}":"
    mkdir -p $AUDIO_PATH/${LANG[$I]}

    OUT=${AUDIO_PATH}/${LANG[$I]}/${LANG[$I]}

    TEXT=${TRANSLATIONS[$((11*I))]}
    echo $TEXT
    gtts-cli "$TEXT" --lang ${LANG[$I]} --output ${OUT}.mp3
    # align to 2sec:
    # - add 2sec of silence to the end
    ffmpeg -hide_banner -y -i  ${OUT}.mp3 -af "apad=pad_dur=2" ${OUT}_temp.wav
    # - cut to 2 sec
    ffmpeg -hide_banner -y -i ${OUT}_temp.wav -t 2 ${OUT}.wav
    # cleanup
    rm ${OUT}_temp.wav ${OUT}.mp3

    # add on the top of index.txt
    echo "file ${LANG[$I]}.wav" > $AUDIO_PATH/${LANG[$I]}/index.txt

    for J in {1..10}
    do
        OUT=${AUDIO_PATH}/${LANG[$I]}/${J}
        TEXT=${TRANSLATIONS[$((11*I+J))]}
        echo $TEXT
        gtts-cli "$TEXT" --lang ${LANG[$I]} --output ${OUT}.mp3
        # align each number to 1sec duration filled with silience at the end:
        # - add 1sec of silence to the end
        ffmpeg -hide_banner -y -i  ${OUT}.mp3 -af "apad=pad_dur=1" ${OUT}_temp.wav
        # - cut to 1 sec
        ffmpeg -hide_banner -y -i ${OUT}_temp.wav -t 1  ${OUT}.wav
        # cleanup
        rm ${OUT}_temp.wav ${OUT}.mp3
    done

    #prepare index of 15min track
    # 2sec lang intro aleady added, append 8sec count up starting from 2
    for J in {2..10}
    do
        echo "file ${J}.wav" >> $AUDIO_PATH/${LANG[$I]}/index.txt 
    done

    #append rest 10sec sequences up to the end of video
    for J in $(seq 2 $((VIDEO_LENGTH_SEC/10)))
    do
        for K in {1..10}
        do
            echo "file ${K}.wav" >> $AUDIO_PATH/${LANG[$I]}/index.txt
        done
    done 

    #generate ful track from index.txt
    ffmpeg -hide_banner -y -f concat -i $AUDIO_PATH/${LANG[$I]}/index.txt -c copy  ${AUDIO_PATH}/${LANG[$I]}/full_track.wav

    #generate HLS audio track
    ffmpeg -hide_banner -y -i ${AUDIO_PATH}/${LANG[$I]}/full_track.wav -map 0:a -c:a aac -b:a 384k -ar 48000 -t $VIDEO_LENGTH_SEC -hls_time $VIDEO_SEGMENT_SEC -hls_playlist_type vod -hls_segment_filename $HLS_OUT/${LANG[$I]}_%d.ts  $HLS_OUT/${LANG[$I]}.m3u8

    #generate DASH content with HLS manifest output
    ffmpeg -hide_banner -y -i ${AUDIO_PATH}/${LANG[$I]}/full_track.wav -map 0:a -c:a aac -b:a 384k -ar 48000 -t $VIDEO_LENGTH_SEC -hls_segment_type fmp4  -hls_time $VIDEO_SEGMENT_SEC -hls_playlist_type vod -hls_segment_filename $DASH_OUT/${LANG[$I]}_'%03d.mp3' -hls_fmp4_init_filename ${LANG[$I]}_init.m4s -start_number 1  $DASH_OUT/${LANG[$I]}.m3u8

    # override DASH audio with the same content and generate DASH manifest
    ffmpeg -hide_banner -y -i ${AUDIO_PATH}/${LANG[$I]}/full_track.wav -map 0:a -c:a aac -b:a 384k -ar 48000 -t $VIDEO_LENGTH_SEC  -seg_duration $((VIDEO_SEGMENT_SEC)) -use_timeline 1 -use_template 1 -init_seg_name $DASH_OUT/${LANG[$I]}_init.m4s -media_seg_name $DASH_OUT/${LANG[$I]}_'$Number%03d$.mp3'  -f dash ${LANG[$I]}.mpd

done

#####################################################
# Generate muxed A/V HLS with all languages from above
#####################################################

LANG_639_3=(eng fra deu spa pol)

#add audio inputs
for (( I=0; I<${#LANG[@]}; I++ ))
do
    AUDIO_INPUTS="$AUDIO_INPUTS -i ${AUDIO_PATH}/${LANG[$I]}/full_track.wav"
done

#add audio mapping
for (( I=0; I<${#LANG[@]}; I++ ))
do
    AUDIO_INPUTS="$AUDIO_INPUTS -map $((I+1)):a"
    AUDIO_HLS_MAP="$AUDIO_HLS_MAP -map 0:a:$I"
done

#add audio tags
for (( I=0; I<${#LANG[@]}; I++ ))
do
    AUDIO_INPUTS="$AUDIO_INPUTS -metadata:s:a:$I language=${LANG_639_3[$I]} -metadata:s:a:$I title=\"${LANG_FULL_NAME[$I]}\""
    AUDIO_HLS_MAP="$AUDIO_HLS_MAP -metadata:s:a:$I language=${LANG_639_3[$I]} -metadata:s:a:$I title=\"${LANG_FULL_NAME[$I]}\""
done

for (( I=0; I<${#WIDTH[@]}; I++ ))
do
    #combine video with audio streams
    ffmpeg -hide_banner -y -i overlay${HEIGHT[$I]}.mp4 $AUDIO_INPUTS -map 0:v -c:v h264 -c:a aac overlay${HEIGHT[$I]}_mux.mp4

    #generate muxed HLS
    ffmpeg -hide_banner -y -i overlay${HEIGHT[$I]}_mux.mp4  -map 0:v $AUDIO_HLS_MAP -vf scale=w=${WIDTH[$I]}:h=${HEIGHT[$I]}:force_original_aspect_ratio=decrease -c:v h264 -c:a aac -profile:v main -crf 20 -sc_threshold 0 -g $((FPS*VIDEO_SEGMENT_SEC)) -hls_time ${VIDEO_SEGMENT_SEC} -hls_playlist_type vod  -b:v ${KBPS[$I]}k -maxrate ${MAXKBPS[$I]}k -bufsize 1200k -hls_segment_filename $HLS_OUT/${HEIGHT[$I]}p_mux_%03d.ts $HLS_OUT/${HEIGHT[$I]}p_mux.m3u8

done




