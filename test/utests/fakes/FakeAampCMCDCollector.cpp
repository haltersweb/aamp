/*
 * If not stated otherwise in this file or this component's license file the
 * following copyright and licenses apply:
 *
 * Copyright 2023 RDK Management
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
 * @file AampCMCDCollector.cpp
 * @brief Class to collect the CMCD Data
 */

#include "AampCMCDCollector.h"
#include "StreamAbstractionAAMP.h"



/**
 * @brief AampCMCDCollector - Constructor
 *
 */
AampCMCDCollector::AampCMCDCollector(AampLogManager *logObj)
{
}

/**
 * @brief AampCMCDCollector - Destructor
 *
 */
AampCMCDCollector::~AampCMCDCollector()
{

}

/**
* @brief Initialize the CMCDCollector , create storage for metrics
*
* @return None
*/
void AampCMCDCollector::Initialize(bool enableDisable , std::string &traceId)
{
}



/**
* @brief CMCDSetNextObjectRequest Store the next segment uri for stream type
*
* @return None
*/
void AampCMCDCollector::CMCDSetNextObjectRequest(std::string url, long long SeqNo,long CMCDBandwidth,MediaType mediaT)
{
}


/**
* @brief CMCDGetHeaders Get the CMCD headers to add in downlaod request
*
* @return None
*/
void AampCMCDCollector::CMCDGetHeaders(MediaType fileType , std::vector<std::string> &customHeader)
{
 }
 

/**
* @brief CMCDSetNetworkMetrics Set Network Metrics for CMCD
*
* @return None
*/
void AampCMCDCollector::CMCDSetNetworkMetrics(MediaType fileType,  int startTransferTime, int totalTime, int dnsLookUpTime)
{
}

/**
* @brief Collect and send all key-value pairs for CMCD headers.
*/
void AampCMCDCollector::SetBitrates(MediaType fileType,const std::vector<long> bitrateList)
{
}



/**
* @brief Collect and send all key-value pairs for CMCD headers.
*/
void AampCMCDCollector::SetTrackData(MediaType fileType,bool bufferRedStatus,int bufferedDuration,int currentBitrate, bool IsMuxed)
{

}

