var axios = require("axios");
var sabreConfig = require("../config/sabre");
var loggerService = require("./loggerService");

var logToFile = loggerService.logToFile;

// Token cache
var cachedToken = null;
var tokenExpiresAt = 0;

function getAccessToken() {
  // If manual token is provided, use it directly
  if (sabreConfig.manualToken) {
    console.log("[Sabre] Using manual token from .env");
    cachedToken = sabreConfig.manualToken;
    tokenExpiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    return Promise.resolve(cachedToken);
  }

  // Otherwise, try OAuth2 authentication
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    console.log("[Sabre] Using cached token");
    return Promise.resolve(cachedToken);
  }

  console.log("[Sabre] Requesting new token...");
  console.log("[Sabre] Token URL: " + sabreConfig.tokenUrl);

  var userId = "V1:" + sabreConfig.epr + ":" + sabreConfig.pcc + ":" + sabreConfig.domain;
  console.log("[Sabre] User ID: " + userId);

  var encodedUserId = Buffer.from(userId).toString("base64");
  console.log("[Sabre] Encoded User ID: " + encodedUserId);

  var credentials = Buffer.from(encodedUserId + ":" + sabreConfig.password).toString("base64");

  logToFile("login_Rq", {
    url: sabreConfig.tokenUrl,
    method: "POST",
    grant_type: "client_credentials",
    userId: userId,
  });

  return axios
    .post(sabreConfig.tokenUrl, "grant_type=client_credentials", {
      headers: {
        Authorization: "Basic " + credentials,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    .then(function (response) {
      var tokenData = response.data;
      logToFile("login_Rs", tokenData);

      cachedToken = tokenData.access_token;
      tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;

      console.log("[Sabre] ✅ Token received successfully");
      return cachedToken;
    })
    .catch(function (error) {
      var errorData = error.response
        ? { status: error.response.status, data: error.response.data }
        : { message: error.message };

      logToFile("login_Rs", { error: true, details: errorData });
      console.error("[Sabre] ❌ Auth failed:", JSON.stringify(errorData));

      throw new Error("Sabre Auth Failed: " + JSON.stringify(errorData));
    });
}

function searchFlights(searchParams) {
  // console.log("[Sabre] Searching flights...");
  // console.log("[Sabre] Search params:", JSON.stringify(searchParams));
  // console.log("[Sabre] BFM URL: " + sabreConfig.bfmUrl);

  // Log the search request FIRST (even before getting token)
  var requestBody = buildBFMRequest(searchParams);
  logToFile("search_Rq", requestBody);

  return getAccessToken()
    .then(function (token) {
      return axios
        .post(sabreConfig.bfmUrl, requestBody, {
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
        })
        .then(function (response) {
          var responseData = response.data;
          responseData.APItype = "#Sabre";
  
          logToFile("search_Rs", responseData);

          var parsedResults = parseBFMResponse(responseData);
          return parsedResults;
        });
    })
    .catch(function (error) {
      var errorData = error.response
        ? { status: error.response.status, data: error.response.data }
        : { message: error.message };

      logToFile("search_Rs", { error: true, details: errorData });
      console.error("[Sabre] ❌ Search failed:", JSON.stringify(errorData));

      throw new Error("Sabre Search Failed: " + JSON.stringify(errorData));
    });
}

function buildBFMRequest(params) {
  var tripType = params.tripType;
  var origin = params.origin;
  var destination = params.destination;
  var departureDate = params.departureDate;
  var returnDate = params.returnDate;
  var adults = params.adults;
  var children = params.children;
  var infants = params.infants;

  var originDestInfo = [
    {
      DepartureDateTime: departureDate + "T12:00:00",
      OriginLocation: { LocationCode: origin.toUpperCase() },
      DestinationLocation: { LocationCode: destination.toUpperCase() },
    },
  ];

  if (tripType === "roundtrip" && returnDate) {
    originDestInfo.push({
      DepartureDateTime: returnDate + "T12:00:00",
      OriginLocation: { LocationCode: destination.toUpperCase() },
      DestinationLocation: { LocationCode: origin.toUpperCase() },
    });
  }

  var passengers = [];
  if (adults > 0) {
    passengers.push({
      Quantity: adults,
      Code: "ADT",
      TPA_Extensions: { VoluntaryChanges: { Match: "Info" } },
    });
  }
  if (children > 0) {
    passengers.push({
      Quantity: children,
      Code: "CNN",
      TPA_Extensions: { VoluntaryChanges: { Match: "Info" } },
    });
  }
  if (infants > 0) {
    passengers.push({
      Quantity: infants,
      Code: "INF",
      TPA_Extensions: { VoluntaryChanges: { Match: "Info" } },
    });
  }

  return {
    OTA_AirLowFareSearchRQ: {
      Version: "5",
      POS: {
        Source: [
          {
            PseudoCityCode: sabreConfig.pcc,
            RequestorID: {
              Type: "1",
              ID: "1",
              CompanyName: { Code: "TN" },
            },
          },
        ],
      },
      OriginDestinationInformation: originDestInfo,
      TravelPreferences: {
        Baggage: { RequestType: "A", Description: true },
      },
      TravelerInfoSummary: {
        AirTravelerAvail: [{ PassengerTypeQuantity: passengers }],
      },
      TPA_Extensions: {
        IntelliSellTransaction: {
          RequestType: { Name: "50ITINS" },
        },
      },
    },
  };
}

function parseBFMResponse(raw) {
  try {
    if (raw.groupedItineraryResponse) {
      return parseGIRv5(raw);
    }
    if (raw.OTA_AirLowFareSearchRS) {
      return parseOTA(raw);
    }
    console.log("[Sabre] Unknown response format");
    return { success: true, count: 0, flights: [] };
  } catch (e) {
    console.error("[Sabre] Parse error:", e.message);
    return { success: false, error: "Parse error: " + e.message };
  }
}

function parseGIRv5(raw) {
  var gir = raw.groupedItineraryResponse;
  var apiType = raw.APItype || "#Sabre";

          // logToFile("#AUDIT", gir);

  if (raw.OTA_AirLowFareSearchRS && raw.OTA_AirLowFareSearchRS.Errors) {
    return { success: false, error: raw.OTA_AirLowFareSearchRS.Errors };
  }

  // Build lookup maps for compressed references
  var scheduleMap = buildRefMap(gir.scheduleDescs || []);
  var legMap      = buildRefMap(gir.legDescs || []);
  var taxMap      = buildRefMap(gir.taxDescs || []);
  var fareCompMap = buildRefMap(gir.fareComponentDescs || []);
  var vcMap       = buildRefMap(gir.validatingCarrierDescs || []);
  var bagMap      = buildRefMap(gir.baggageAllowanceDescs || []);

  var groups = gir.itineraryGroups || [];
  var flights = [];
console.log("Data inside flights variable are : ",flights);

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
     var legs = group.groupDescription?.legDescriptions || [];
    var departureDates = legs.map(function (leg) {
      return leg.departureDate || null;
    });

    var itins = group.itineraries || [];
    for (var i = 0; i < itins.length; i++) {
      var itin = itins[i];
      var flight = {
        id: itin.id || (flights.length + 1),
        directionInd: "OneWay",
        segments: [],
        pricing: [],
        validatingCarrier: [],
      };

      // Resolve legs via references
      var legs = itin.legs || [];
      if (legs.length > 1) flight.directionInd = "Return";

      for (var l = 0; l < legs.length; l++) {
        var legRef = legs[l].ref;
        var legDesc = legMap[legRef];
        if (!legDesc) continue;

        // Resolve schedules within this leg
        var schedRefs = legDesc.schedules || [];
        for (var s = 0; s < schedRefs.length; s++) {
          var schedRef = schedRefs[s].ref;
          var sched = scheduleMap[schedRef];
          if (!sched) continue;

          flight.segments.push({
            departureAirport:  sched.departure && sched.departure.airport,
            departureCity:     sched.departure && sched.departure.city,
            departureTime:     sched.departure && sched.departure.time,

            departureDate: departureDates[l] || null,
            
            departureTerminal: sched.departure && sched.departure.terminal,
            arrivalAirport:    sched.arrival && sched.arrival.airport,
            arrivalCity:       sched.arrival && sched.arrival.city,
            arrivalTime:       sched.arrival && sched.arrival.time,

              arrivalDate: getArrivalDate(
                departureDates[l],
                sched.arrival && sched.arrival.dateAdjustment
              ),

            arrivalTerminal:   sched.arrival && sched.arrival.terminal,
            dateAdjustment:    sched.arrival && sched.arrival.dateAdjustment || 0,
            marketingAirline:  sched.carrier && sched.carrier.marketing,
            operatingAirline:  sched.carrier && sched.carrier.operating,
            flightNumber:      sched.carrier && sched.carrier.marketingFlightNumber,
            operatingFlightNumber: sched.carrier && sched.carrier.operatingFlightNumber,
            equipment:         sched.carrier && sched.carrier.equipment && sched.carrier.equipment.code,
            elapsedTime:       sched.elapsedTime,
            stops:             sched.stopCount || 0,
            miles:             sched.totalMilesFlown,
            eTicketable:       sched.eTicketable,
          });
          
          flight.validatingCarrier.push({
            validatingCarrier:  sched.carrier && sched.carrier.marketing,
          })

        }
      }

      // Resolve pricing
      var prics = itin.pricingInformation || [];
      for (var p = 0; p < prics.length; p++) {
        var pr = prics[p];
        var fare = pr.fare || {};
        var tf = fare.totalFare || {};

        // Validating carrier
        var vcCode = null;
        var vcRefs = fare.validatingCarriers || [];
        if (vcRefs.length > 0 && vcMap[vcRefs[0].ref]) {
          var vcDesc = vcMap[vcRefs[0].ref];
          vcCode = vcDesc.default && vcDesc.default.code;
        }
        if (vcCode) flight.validatingCarrier = vcCode;

        // Passenger pricing details
      {/*
          var passengerDetails = [];
          var pInfoList = fare.passengerInfoList || [];
          for (var pi = 0; pi < pInfoList.length; pi++) {
            var pInfo = pInfoList[pi].passengerInfo || {};
            var pTotalFare = pInfo.passengerTotalFare || {};

            passengerDetails.push({
              passengerType:    pInfo.passengerType,
              passengerNumber:  pInfo.passengerNumber,
              nonRefundable:    pInfo.nonRefundable || false,
              totalFare:        pTotalFare.totalFare,
              totalTaxAmount:   pTotalFare.totalTaxAmount,
              currency:         pTotalFare.currency,
              baseFareAmount:   pTotalFare.baseFareAmount,
              baseFareCurrency: pTotalFare.baseFareCurrency,
              equivAmount:      pTotalFare.equivalentAmount,
              equivCurrency:    pTotalFare.equivalentCurrency,
              lastTicketDate:   fare.lastTicketDate,
              lastTicketTime:   fare.lastTicketTime,
            });
          }
      */}
              var passengerDetails = [];
              var pInfoList = fare.passengerInfoList || [];

              for (var pi = 0; pi < pInfoList.length; pi++) {
                var pInfo = pInfoList[pi].passengerInfo || {};
                var pTotalFare = pInfo.passengerTotalFare || {};
                // var pBaggageInfo = pInfo.baggageInformation || {};

                /* ── Resolve fare components ── */
                var resolvedFareComps = [];
                var fComps = pInfo.fareComponents || [];
                for (var fc = 0; fc < fComps.length; fc++) {
                  var fcRef  = fComps[fc].ref;
                  var fcDesc = fcRef ? fareCompMap[fcRef] : {};
                  var fcSegs = (fComps[fc].segments || []).map(function (s) {
                    return s.segment || {};
                  });
                  resolvedFareComps.push({
                    beginAirport: fComps[fc].beginAirport,
                    endAirport:   fComps[fc].endAirport,
                    fareBasis:    fcDesc.fareBasis || "",
                    bookingCode:  fcSegs.length ? fcSegs[0].bookingCode : "",
                    cabinCode:    fcSegs.length ? fcSegs[0].cabinCode   : "",
                  });
                }

                /* ── Resolve baggage allowance ── */
                var resolvedBaggage = [];
                var bagInfos = pInfo.baggageInformation || [];
                for (var bi = 0; bi < bagInfos.length; bi++) {
                  var bEntry     = bagInfos[bi];
                  var allowRef   = bEntry.allowance && bEntry.allowance.ref;
                  var allowDesc  = allowRef ? bagMap[allowRef] : null;
                  resolvedBaggage.push({
                    provisionType: bEntry.provisionType,
                    airlineCode:   bEntry.airlineCode,
                    segmentIds:    (bEntry.segments || []).map(function (s) { return s.id; }),
                    allowance: allowDesc
                      ? {
                          pieceCount:   allowDesc.pieceCount,
                          weight:       allowDesc.weight,
                          unit:         allowDesc.unit,
                          description1: allowDesc.description1,
                          description2: allowDesc.description2,
                        }
                      : null,
                  });
                }

                passengerDetails.push({
                  passengerType:    pInfo.passengerType,
                  passengerNumber:  pInfo.passengerNumber,
                  nonRefundable:    pInfo.nonRefundable || false,
                  totalFare:        pTotalFare.totalFare,
                  totalTaxAmount:   pTotalFare.totalTaxAmount,
                  currency:         pTotalFare.currency,
                  baseFareAmount:   pTotalFare.baseFareAmount,
                  baseFareCurrency: pTotalFare.baseFareCurrency,
                  equivAmount:      pTotalFare.equivalentAmount,
                  equivCurrency:    pTotalFare.equivalentCurrency,
                  lastTicketDate:   fare.lastTicketDate,
                  lastTicketTime:   fare.lastTicketTime,
                  fareComponents:   resolvedFareComps,
                  baggage:          resolvedBaggage,
                });
              }

        flight.pricing.push({
          totalPrice:       tf.totalPrice,
          totalTaxAmount:   tf.totalTaxAmount,
          currency:         tf.currency,
          baseFareAmount:   tf.baseFareAmount,
          baseFareCurrency: tf.baseFareCurrency,
          equivAmount:      tf.equivalentAmount,
          equivCurrency:    tf.equivalentCurrency,
          pricingSource:    itin.pricingSource || null,
          pricingSubsource: pr.pricingSubsource || null,
          distributionModel: pr.distributionModel || null,
          passengers:       passengerDetails,
          validatingCarrier: vcCode,
        });
      }

      if (flight.segments.length > 0) {
        flights.push(flight);
      }
    }
  }

  console.log("[Sabre] Parsed " + flights.length + " flights (GIR v5)");
  return { success: true, count: flights.length, APItype: apiType, flights: flights };
}


function getArrivalDate(departureDate, dateAdjustment) {
  if (!departureDate) return null;

  var date = new Date(departureDate + "T00:00:00Z");

  date.setUTCDate(
    date.getUTCDate() + Number(dateAdjustment || 0)
  );

  return date.toISOString().slice(0, 10);
}

/**
 * Build a lookup map from a descriptors array: { id: N, ... } → { N: { ... } }
 */
function buildRefMap(descs) {
  var map = {};
  for (var i = 0; i < descs.length; i++) {
    map[descs[i].id] = descs[i];
  }
  return map;
}

function parseOTA(raw) {
  var rs = raw.OTA_AirLowFareSearchRS;
  if (rs.Errors) {
    return { success: false, error: rs.Errors };
  }

  var items = (rs.PricedItineraries && rs.PricedItineraries.PricedItinerary) || [];
  if (!Array.isArray(items)) items = [items];

  var flights = [];
  for (var i = 0; i < items.length; i++) {
    var itin = items[i];
    var flight = {
      sequenceNumber: itin.SequenceNumber,
      directionInd: "OneWay",
      segments: [],
      pricing: [],
    };

    var odOpts =
      (itin.AirItinerary &&
        itin.AirItinerary.OriginDestinationOptions &&
        itin.AirItinerary.OriginDestinationOptions.OriginDestinationOption) ||
      [];
    if (!Array.isArray(odOpts)) odOpts = [odOpts];

    for (var j = 0; j < odOpts.length; j++) {
      var segs = odOpts[j].FlightSegment || [];
      if (!Array.isArray(segs)) segs = [segs];
      for (var k = 0; k < segs.length; k++) {
        var s = segs[k];
        flight.segments.push({
          departureAirport: s.DepartureAirport && s.DepartureAirport.LocationCode,
          arrivalAirport: s.ArrivalAirport && s.ArrivalAirport.LocationCode,
          departureDateTime: s.DepartureDateTime,
          arrivalDateTime: s.ArrivalDateTime,
          marketingAirline: s.MarketingAirline && s.MarketingAirline.Code,
          flightNumber: s.FlightNumber,
          cabin: s.ResBookDesigCabin && s.ResBookDesigCabin.Cabin,
          elapsedTime: s.ElapsedTime,
        });
      }
    }

    var prics = itin.AirItineraryPricingInfo || [];
    if (!Array.isArray(prics)) prics = [prics];
    for (var p = 0; p < prics.length; p++) {
      var pr = prics[p];
      flight.pricing.push({
        totalPrice:
          pr.ItinTotalFare && pr.ItinTotalFare.TotalFare && pr.ItinTotalFare.TotalFare.Amount,
        currency:
          pr.ItinTotalFare && pr.ItinTotalFare.TotalFare && pr.ItinTotalFare.TotalFare.CurrencyCode,
        passengerType: pr.PassengerTypeQuantity && pr.PassengerTypeQuantity.Code,
        passengerQty: pr.PassengerTypeQuantity && pr.PassengerTypeQuantity.Quantity,
      });
    }

    flights.push(flight);
  }
  return { success: true, count: flights.length, flights: flights };
}

function parseGIR(raw) {
  var gir = raw.groupedItineraryResponse;
  if (raw.OTA_AirLowFareSearchRS && raw.OTA_AirLowFareSearchRS.Errors) {
    return { success: false, error: raw.OTA_AirLowFareSearchRS.Errors };
  }

  var flights = [];
  var groups = gir.itineraryGroups || [];

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
    var itins = group.itineraries || [];

    for (var i = 0; i < itins.length; i++) {
      var itin = itins[i];
      var flight = {
        sequenceNumber: itin.sequence || flights.length + 1,
        directionInd: "OneWay",
        segments: [],
        pricing: [],
      };

      var legs = itin.legs || [];
      if (legs.length > 1) flight.directionInd = "Return";

      for (var l = 0; l < legs.length; l++) {
        var scheds = legs[l].schedule || [];
        for (var s = 0; s < scheds.length; s++) {
          var sc = scheds[s];
          flight.segments.push({
            departureAirport: sc.departure && sc.departure.airport,
            arrivalAirport: sc.arrival && sc.arrival.airport,
            departureDateTime: sc.departure && sc.departure.time,
            arrivalDateTime: sc.arrival && sc.arrival.time,
            marketingAirline: sc.carrier && sc.carrier.marketing,
            flightNumber: sc.carrier && sc.carrier.marketingFlightNumber,
            cabin: sc.cabin && sc.cabin.code,
            elapsedTime: sc.elapsedTime,
          });
        }
      }

      var prics = itin.pricingInformation || [];
      if (!Array.isArray(prics)) prics = [prics];
      for (var p = 0; p < prics.length; p++) {
        var fare = prics[p].fare || {};
        var tf = fare.totalFare || {};
        flight.pricing.push({
          totalPrice: tf.totalAmount || tf.amount,
          currency: tf.currencyCode,
          baseFare: fare.baseFare && fare.baseFare.amount,
          passengerType: fare.passengerInfo && fare.passengerInfo.passengerType,
          passengerQty: fare.passengerInfo && fare.passengerInfo.passengerQuantity,
        });
      }

      if (flight.segments.length > 0) flights.push(flight);
    }
  }

  console.log("[Sabre] Parsed " + flights.length + " flights (GIR format)");
  return { success: true, count: flights.length, flights: flights };
}

module.exports = {
  getAccessToken: getAccessToken,
  searchFlights: searchFlights,
};