/*
 * If not stated otherwise in this file or this component's license file the
 * following copyright and licenses apply:
 *
 * Copyright 2022 RDK Management
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

/**
 * @file Aampcli.cpp
 * @brief Stand alone AAMP player with command line interface.
 */

#include "Aampcli.h"

Aampcli mAampcli;
extern VirtualChannelMap mVirtualChannelMap;
extern void tsdemuxer_InduceRollover( bool enable );

Aampcli :: Aampcli():
	mInitialized(false),
	mEnableProgressLog(false),
	mbAutoPlay(true),
	mTuneFailureDescription(""),
	mSingleton(NULL),
	mEventListener(NULL),
	mAampGstPlayerMainLoop(NULL),
	mAampMainLoopThread(NULL),
	mPlayerInstances(std::vector<PlayerInstanceAAMP*> ())
{
};

Aampcli::Aampcli(const Aampcli& aampcli):
	mInitialized(false),
	mEnableProgressLog(false),
	mbAutoPlay(true),
	mTuneFailureDescription(""),
	mSingleton(NULL),
	mEventListener(NULL),
	mAampGstPlayerMainLoop(NULL),
	mAampMainLoopThread(NULL),
	mPlayerInstances(std::vector<PlayerInstanceAAMP*> ())

{
	mSingleton = aampcli.mSingleton;
	mEventListener = aampcli.mEventListener;
};

Aampcli& Aampcli::operator=(const Aampcli& aampcli)
{
	return *this;
};

Aampcli :: ~Aampcli()
{
};

void Aampcli::doAutomation( int startChannel, int stopChannel, int maxTuneTimeS, int playTimeS, int betweenTimeS )
{
#if defined (__APPLE__) || defined(UBUNTU)
	std::string outPath(getenv("HOME"));
#else
	std::string outPath("/opt");
#endif
	outPath += "/test-results.csv";
	const char *mod = "wb"; // initially clear file
	CommandHandler lCommandHandler;

	if (mVirtualChannelMap.next() == NULL)
	{
		printf("[AAMPCLI] Can not auto channels, empty virtual channel map.\n");
		return;
	}

	for( int chan=startChannel; chan<=stopChannel; chan++ )
	{
		VirtualChannelInfo *info = mVirtualChannelMap.find(chan);
		if( info )
		{
			if( strstr(info->name.c_str(),"ClearKey") ||
					strstr(info->name.c_str(),"MultiDRM") ||
					strstr(info->name.c_str(),"DTS Audio") ||
					strstr(info->name.c_str(),"AC-4") )
			{
#ifdef __APPLE__
				continue; // skip unsupported DRM AND Audio formats
#endif
			}
			printf( "%d,\"%s\",%s,%s\n",
					info->channelNumber, info->name.c_str(), info->uri.c_str(), "TUNING...");

			char cmd[32];
			snprintf( cmd, sizeof(cmd), "%d", chan );
			mTuneFailureDescription.clear();
			lCommandHandler.dispatchAampcliCommands(cmd,mSingleton);
			PrivAAMPState state = eSTATE_IDLE;
			for(int i=0; i<maxTuneTimeS; i++ )
			{
				sleep(1);
				state = mSingleton->GetState();
				if( state == eSTATE_PLAYING || state == eSTATE_ERROR )
				{
					break;
				}
			}
			const char *stateName;
			switch( state )
			{
				case eSTATE_PLAYING:
					sleep(playTimeS); // let play for a bit longer, as visibility sanity check
					stateName = "OK";
					printf( "***STOP***\n" );
					mSingleton->Stop();
					sleep( betweenTimeS );
					printf( "***NEXT***\n" );
					break;
				case eSTATE_ERROR:
					stateName = "FAIL";
					break;
				default:
					stateName = "TIMEOUT";
					break;
			}
			printf( "***%s\n", stateName );
			FILE *f = fopen( outPath.c_str(), mod );
			assert( f );
			fprintf( f, "%d,\"%s\",%s,%s,%s\n",
					info->channelNumber, info->name.c_str(), info->uri.c_str(), stateName, mTuneFailureDescription.c_str() );
			mod = "a";
			fclose( f );
		}
	}
}

void Aampcli::runCommand( void* args )
{
	std::vector<std::string> *arguments;
	std::vector<std::string> cmdVec;
	CommandHandler lCommandHandler;

	lCommandHandler.registerAampcliCommands();
	using_history();

	if( args )
	{
		arguments = static_cast<std::vector<std::string>*>(args);
		cmdVec = *arguments;
		if(!cmdVec.empty())
		{
			bool first = true;
			std::string cmd;
			for(auto param : cmdVec)
			{ // join cli parameters
				if( first )
				{
					first = false;
				}
				else
				{ // whitespace delimiter prefixed only before subsquent arguments
					cmd += ' ';
				}
				cmd += param;
			}
			lCommandHandler.dispatchAampcliCommands( cmd.c_str(), mAampcli.mSingleton);
		}
	}

	printf("[AAMPCLI] type 'help' for list of available commands\n");

	for(;;)
	{
		rl_attempted_completion_function = lCommandHandler.commandCompletion;
		char *buffer = readline("[AAMPCLI] Enter cmd: ");
		if(buffer == NULL)
		{
			break;
		}
		if( *buffer )
		{ // non-empty line
			add_history(buffer);
			bool l_status = lCommandHandler.dispatchAampcliCommands(buffer,mAampcli.mSingleton);
			if( !l_status )
			{
				exit(0);
			}
		} // if( *buffer )
		free(buffer);
	} // for(;;)
} // Aampcli::runCommand

FILE * Aampcli::getConfigFile(const std::string& cfgFile)
{
	if (cfgFile.empty())
	{
		return NULL;
	}
#ifdef __APPLE__
	std::string cfgBasePath(getenv("HOME"));
	std::string cfgPath = cfgBasePath + cfgFile;
	FILE *f = fopen(cfgPath.c_str(), "rb");
#else
	std::string cfgPath = "/opt" + cfgFile;
	FILE *f = fopen(cfgPath.c_str(), "rb");
#endif

	return f;
}

/**
 * @brief Thread to run mainloop (for standalone mode)
 * @param[in] arg user_data
 * @retval void pointer
 */
void * Aampcli::aampGstPlayerStreamThread(void *arg)
{
	if (mAampcli.mAampGstPlayerMainLoop)
	{
		g_main_loop_run(mAampcli.mAampGstPlayerMainLoop); // blocks
		printf("[AAMPCLI] aampGstPlayerStreamThread: exited main event loop\n");
	}
	g_main_loop_unref(mAampcli.mAampGstPlayerMainLoop);
	mAampcli.mAampGstPlayerMainLoop = NULL;
	return NULL;
}

/**
 * @brief To initialize Gstreamer and start mainloop (for standalone mode)
 * @param[in] argc number of arguments
 * @param[in] argv array of arguments
 */
void Aampcli::initPlayerLoop(int argc, char **argv)
{
	if (!mInitialized)
	{
		mInitialized = true;
		gst_init(&argc, &argv);
		mAampGstPlayerMainLoop = g_main_loop_new(NULL, FALSE);
		mAampMainLoopThread = g_thread_new("AAMPGstPlayerLoop", &aampGstPlayerStreamThread, NULL );
	}
}

void Aampcli::newPlayerInstance( void )
{
	PlayerInstanceAAMP *player = new PlayerInstanceAAMP(
#ifdef RENDER_FRAMES_IN_APP_CONTEXT
			NULL
			,Shader::updateYUVFrame
#endif
			);
	if( !mEventListener )
	{ // for now, use common event listener (could be instance specific)
		printf( "allocating new MyAAMPEventListener\n");
		mEventListener = new MyAAMPEventListener();
	}
	player->RegisterEvents(mEventListener);
	auto playerIndex = mPlayerInstances.size();
	printf( "new playerInstance; index=%lu\n", playerIndex );
	mPlayerInstances.push_back(player);
	mSingleton = player; // select
	mSingleton->SetContentProtectionDataUpdateTimeout(0);
}


/**
 * @brief
 * @param argc
 * @param argv
 * @retval
 */
int main(int argc, char **argv)
{
	char driveName = (*argv)[0];
	AampLogManager mLogManager;
	AampLogManager::disableLogRedirection = true;
	ABRManager mAbrManager;

	signal(SIGINT, Harvestor::harvestTerminateHandler);

	/* Set log directory path for AAMP and ABR Manager */
	mLogManager.setLogAndCfgDirectory(driveName);
	mAbrManager.setLogDirectory(driveName);

	printf("**************************************************************************\n");
	printf("** ADVANCED ADAPTIVE MEDIA PLAYER (AAMP) - COMMAND LINE INTERFACE (CLI) **\n");
	printf("**************************************************************************\n");

	mAampcli.initPlayerLoop(0,NULL);
	mAampcli.newPlayerInstance();

	// Read/create virtual channel map
	const std::string cfgCSV("/aampcli.csv");
	const std::string cfgLegacy("/aampcli.cfg");
	FILE *f;
	if ( (f = mAampcli.getConfigFile(cfgCSV)) != NULL)
	{ // open virtual map from csv file
		printf("[AAMPCLI] opened aampcli.csv\n");
		mVirtualChannelMap.loadVirtualChannelMapFromCSV( f );
		fclose( f );
		f = NULL;
	}
	else if ( (f = mAampcli.getConfigFile(cfgLegacy)) != NULL)
	{  // open virtual map from legacy cfg file
		printf("[AAMPCLI] opened aampcli.cfg\n");
		mVirtualChannelMap.loadVirtualChannelMapLegacyFormat(f);
		fclose(f);
		f = NULL;
	}

	std::vector<std::string> arguments;
	for(int i = 1; i < argc; i++)
	{
		arguments.push_back(std::string(argv[i]));
	}

	std::thread cmdThreadId;
	try {
		cmdThreadId = std::thread(&mAampcli.runCommand, (void *) &arguments);
	}catch (std::exception& e)
	{
		printf("[AAMPCLI] Failed at create thread error %s\n",e.what());  //CID:83593 - checked return
	}

#ifdef RENDER_FRAMES_IN_APP_CONTEXT
	// Render frames in graphics plane using opengl
	glutInit(&argc, argv);
	glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
	glutInitWindowPosition(80, 80);
	glutInitWindowSize(640, 480);
	glutCreateWindow("AAMP Texture Player");
	printf("[AAMPCLI] OpenGL Version[%s] GLSL Version[%s]\n", glGetString(GL_VERSION), glGetString(GL_SHADING_LANGUAGE_VERSION));
#ifndef __APPLE__
	glewInit();
#endif
	Shader l_Shader;
	l_Shader.InitShaders();
	glutDisplayFunc(l_Shader.glRender);
	glutTimerFunc(40, l_Shader.timer, 0);

	glutMainLoop();
#else
	// Render frames in video plane - default behavior
#ifdef __APPLE__
	createAndRunCocoaWindow();
#endif
#endif
	if(cmdThreadId.joinable())
	{
		cmdThreadId.join();
	}
}

const char *MyAAMPEventListener::stringifyPrivAAMPState(PrivAAMPState state)
{
	static const char *stateName[] =
	{
		"IDLE",
		"INITIALIZING",
		"INITIALIZED",
		"PREPARING",
		"PREPARED",
		"BUFFERING",
		"PAUSED",
		"SEEKING",
		"PLAYING",
		"STOPPING",
		"STOPPED",
		"COMPLETE",
		"ERROR",
		"RELEASED"
	};
	if( state>=eSTATE_IDLE && state<=eSTATE_RELEASED )
	{
		return stateName[state];
	}
	else
	{
		return "UNKNOWN";
	}
}

/**
 * @brief Implementation of event callback
 * @param e Event
 */
void MyAAMPEventListener::Event(const AAMPEventPtr& e)
{
	switch (e->getType())
	{
		case AAMP_EVENT_STATE_CHANGED:
			{
				StateChangedEventPtr ev = std::dynamic_pointer_cast<StateChangedEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_STATE_CHANGED: %s (%d)\n", mAampcli.mEventListener->stringifyPrivAAMPState(ev->getState()), ev->getState());
				break;
			}
		case AAMP_EVENT_SEEKED:
			{
				SeekedEventPtr ev = std::dynamic_pointer_cast<SeekedEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_SEEKED: new positionMs %f\n", ev->getPosition());
				break;
			}
		case AAMP_EVENT_MEDIA_METADATA:
			{
				MediaMetadataEventPtr ev = std::dynamic_pointer_cast<MediaMetadataEvent>(e);
				std::vector<std::string> languages = ev->getLanguages();
				int langCount = ev->getLanguagesCount();
				printf("[AAMPCLI] AAMP_EVENT_MEDIA_METADATA\n");
				for (int i = 0; i < langCount; i++)
				{
					printf("[AAMPCLI] language: %s\n", languages[i].c_str());
				}
				printf("[AAMPCLI] AAMP_EVENT_MEDIA_METADATA\n\tDuration=%ld\n\twidth=%d\n\tHeight=%d\n\tHasDRM=%d\n\tProgreamStartTime=%f\n", ev->getDuration(), ev->getWidth(), ev->getHeight(), ev->hasDrm(), ev->getProgramStartTime());
				int bitrateCount = ev->getBitratesCount();
				std::vector<long> bitrates = ev->getBitrates();
				printf("[AAMPCLI] Bitrates:\n");
				for(int i = 0; i < bitrateCount; i++)
				{
					printf("\t[AAMPCLI] bitrate(%d)=%ld\n", i, bitrates.at(i));
				}
				break;
			}
		case AAMP_EVENT_TUNED:
			{
				printf("[AAMPCLI] AAMP_EVENT_TUNED\n");
				break;
			}
		case AAMP_EVENT_TUNE_FAILED:
			{
				MediaErrorEventPtr ev = std::dynamic_pointer_cast<MediaErrorEvent>(e);
				mAampcli.mTuneFailureDescription = ev->getDescription();
				printf("[AAMPCLI] AAMP_EVENT_TUNE_FAILED reason=%s\n",mAampcli.mTuneFailureDescription.c_str());
				break;
			}
		case AAMP_EVENT_SPEED_CHANGED:
			{
				SpeedChangedEventPtr ev = std::dynamic_pointer_cast<SpeedChangedEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_SPEED_CHANGED current rate=%f\n", ev->getRate());
				break;
			}
		case AAMP_EVENT_DRM_METADATA:
			{
				DrmMetaDataEventPtr ev = std::dynamic_pointer_cast<DrmMetaDataEvent>(e);
				printf("[AAMPCLI] AAMP_DRM_FAILED Tune failure:%d\t\naccess status str:%s\t\naccess status val:%d\t\nResponse code:%d\t\nIs SecClient error:%d\t\n",ev->getFailure(), ev->getAccessStatus().c_str(), ev->getAccessStatusValue(), ev->getResponseCode(), ev->getSecclientError());
				break;
			}
		case AAMP_EVENT_EOS:
			printf("[AAMPCLI] AAMP_EVENT_EOS\n");
			mAampcli.mPlayerInstances[mLogObj->getPlayerId()]->aamp->PausePipeline(true, false);
			break;
		case AAMP_EVENT_PLAYLIST_INDEXED:
			printf("[AAMPCLI] AAMP_EVENT_PLAYLIST_INDEXED\n");
			break;
		case AAMP_EVENT_PROGRESS:
			{
				ProgressEventPtr ev = std::dynamic_pointer_cast<ProgressEvent>(e);
#ifdef __APPLE__
				char string[128];
				snprintf( string, sizeof(string), "%f", ev->getPosition()/1000.0 );
				setSimulatorWindowTitle(string);
#endif
				if(mAampcli.mEnableProgressLog)
				{
					printf("[AAMPCLI] AAMP_EVENT_PROGRESS\n\tDuration=%lf\n\tposition=%lf\n\tstart=%lf\n\tend=%lf\n\tcurrRate=%f\n\tBufferedDuration=%lf\n\tPTS=%lld\n\ttimecode=%s\n\tlatency=%lf\n",ev->getDuration(),ev->getPosition(),ev->getStart(),ev->getEnd(),ev->getSpeed(),ev->getBufferedDuration(),ev->getPTS(),ev->getSEITimeCode(), ev->getLiveLatency());
				}
			}
			break;
		case AAMP_EVENT_CC_HANDLE_RECEIVED:
			{
				CCHandleEventPtr ev = std::dynamic_pointer_cast<CCHandleEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_CC_HANDLE_RECEIVED CCHandle=%lu\n",ev->getCCHandle());
				break;
			}
		case AAMP_EVENT_BITRATE_CHANGED:
			{
				BitrateChangeEventPtr ev = std::dynamic_pointer_cast<BitrateChangeEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_BITRATE_CHANGED\n\tbitrate=%ld\n\tdescription=\"%s\"\n\tresolution=%dx%d@%ffps\n\ttime=%d\n\tposition=%lf\n", ev->getBitrate(), ev->getDescription().c_str(), ev->getWidth(), ev->getHeight(), ev->getFrameRate(), ev->getTime(), ev->getPosition());
				break;
			}
		case AAMP_EVENT_AUDIO_TRACKS_CHANGED:
			printf("[AAMPCLI] AAMP_EVENT_AUDIO_TRACKS_CHANGED\n");
			break;
		case AAMP_EVENT_TEXT_TRACKS_CHANGED:
			printf("[AAMPCLI] AAMP_EVENT_TEXT_TRACKS_CHANGED\n");
			break;
		case AAMP_EVENT_ID3_METADATA:
			printf("[AAMPCLI] AAMP_EVENT_ID3_METADATA\n");
			break;
		case AAMP_EVENT_BLOCKED :
			{
				BlockedEventPtr ev = std::dynamic_pointer_cast<BlockedEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_BLOCKED Reason:%s\n" ,ev->getReason().c_str());
				break;
			}
		case AAMP_EVENT_CONTENT_GAP :
			{
				ContentGapEventPtr ev = std::dynamic_pointer_cast<ContentGapEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_CONTENT_GAP\n\tStart:%lf\n\tDuration:%lf\n", ev->getTime(), ev->getDuration());
				break;
			}
		case AAMP_EVENT_WATERMARK_SESSION_UPDATE:
			{
				WatermarkSessionUpdateEventPtr ev = std::dynamic_pointer_cast<WatermarkSessionUpdateEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_WATERMARK_SESSION_UPDATE SessionHandle:%d Status:%d System:%s\n" ,ev->getSessionHandle(), ev->getStatus(), ev->getSystem().c_str());
				break;
			}
		case AAMP_EVENT_BUFFERING_CHANGED:
			{
				BufferingChangedEventPtr ev = std::dynamic_pointer_cast<BufferingChangedEvent>(e);
				printf("[AAMPCLI] AAMP_EVENT_BUFFERING_CHANGED Sending Buffer Change event status (Buffering): %s", (ev->buffering() ? "End": "Start"));
				break;
			}
		case AAMP_EVENT_CONTENT_PROTECTION_DATA_UPDATE:
			{
				ContentProtectionDataEventPtr ev =  std::dynamic_pointer_cast<ContentProtectionDataEvent>(e);
				printf("[AMPCLI] AAMP_EVENT_CONTENT_PROTECTION_UPDATE received stream type %s\n",ev->getStreamType().c_str());
				std::vector<uint8_t> key = ev->getKeyID();
				printf("[AMPCLI] AAMP_EVENT_CONTENT_PROTECTION_UPDATE received key is ");
				for(int i=0;i<key.size();i++)
					printf("%x",key.at(i)&0xff);
				printf("\n");
				cJSON *root = cJSON_CreateObject();
				cJSON *KeyId = cJSON_CreateArray();
				for(int i=0;i<key.size();i++)
					cJSON_AddItemToArray(KeyId, cJSON_CreateNumber(key.at(i)));
				cJSON_AddItemToObject(root,"keyID",KeyId);
				//     cJSON_AddItemToObject(root, "com.widevine.alpha", cJSON_CreateString("mds.ccp.xcal.tv"));
				//     cJSON_AddItemToObject(root, "com.microsoft.playready", cJSON_CreateString("mds-stage.ccp.xcal.tv"));
				std::string json = cJSON_Print(root);
				mAampcli.mSingleton->ProcessContentProtectionDataConfig(json.c_str());
				break;
			}
		default:
			break;
	}
}
