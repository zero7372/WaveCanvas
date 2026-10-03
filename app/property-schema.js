// Generated from project.json. Do not edit; run node scripts/generate-schema.cjs.
window.VisualizerPropertySchema = {
  "sourceHash": "ba2e2459efda957da515c43436dab8d5df2efe11207ab86cdb996a5436575af3",
  "properties": {
    "audiocount": {
      "max": 896,
      "min": 1,
      "order": 373,
      "text": "Audio Count",
      "type": "slider",
      "value": 128
    },
    "audiocount1": {
      "order": 374,
      "text": "<p>To have full audio array <br> 128 256 384 512 640 768 896</p>",
      "type": "text"
    },
    "autobarsrotate": {
      "order": 355,
      "text": "Auto Rotate",
      "type": "bool",
      "value": false
    },
    "autobarsrotatespeed": {
      "condition": "autobarsrotate.value",
      "max": 20,
      "min": -20,
      "order": 365,
      "text": "Rotation Speed",
      "type": "slider",
      "value": 0
    },
    "autologorotate": {
      "condition": "logoimage.value",
      "order": 220,
      "text": "Auto Logo Rotate",
      "type": "bool",
      "value": false
    },
    "autologorotatespeed": {
      "condition": "autologorotate.value",
      "max": 20,
      "min": -20,
      "order": 225,
      "text": "Rotation Speed",
      "type": "slider",
      "value": 0
    },
    "background": {
      "order": 25,
      "text": "<h4>Background</h4>",
      "type": "text"
    },
    "backgroundcolor": {
      "condition": "backgroundsource.value == 1",
      "order": 35,
      "text": "Background Color",
      "type": "color",
      "value": "0 0 0"
    },
    "backgroundimage": {
      "condition": "backgroundsource.value == 2",
      "order": 40,
      "text": "Image",
      "type": "file",
      "value": ""
    },
    "backgroundimagef": {
      "order": 505,
      "text": "Image",
      "type": "file",
      "value": ""
    },
    "backgroundsource": {
      "options": [
        {
          "label": "Color",
          "value": 1
        },
        {
          "label": "Image",
          "value": 2
        },
        {
          "label": "Video",
          "value": 4
        }
      ],
      "order": 30,
      "text": "BackgroundType",
      "type": "combo",
      "value": 1
    },
    "backgroundvideonumber": {
      "condition": "backgroundsource.value == 4",
      "options": [
        {
          "label": "UserDefined1",
          "value": 1
        },
        {
          "label": "UserDefined2",
          "value": 2
        },
        {
          "label": "UserDefined3",
          "value": 3
        },
        {
          "label": "UserDefined4",
          "value": 4
        },
        {
          "label": "UseDefined5",
          "value": 5
        }
      ],
      "order": 65,
      "text": "Video Source",
      "type": "combo",
      "value": 1
    },
    "barandcircledistance": {
      "order": 305,
      "text": "<h4>Gap between Circle and Bars</h4>",
      "type": "text"
    },
    "barcircledistance": {
      "max": 500,
      "min": 0,
      "order": 310,
      "text": "Gap between Circle and Bars",
      "type": "slider",
      "value": 16
    },
    "barcolor": {
      "condition": "barcolortype.value == 1",
      "order": 330,
      "text": "Color",
      "type": "color",
      "value": "1 1 1"
    },
    "barcolortype": {
      "options": [
        {
          "label": "Normal",
          "value": 1
        },
        {
          "label": "Rainbow",
          "value": 2
        },
        {
          "label": "Style1",
          "value": 3
        },
        {
          "label": "Style2",
          "value": 4
        }
      ],
      "order": 325,
      "text": "Bar Color Type",
      "type": "combo",
      "value": 1
    },
    "barheight": {
      "max": 3000,
      "min": 0,
      "order": 345,
      "text": "Max-Height",
      "type": "slider",
      "value": 100
    },
    "baropacity": {
      "max": 100,
      "min": 0,
      "order": 335,
      "text": "Opacity%",
      "type": "slider",
      "value": 100
    },
    "bars": {
      "order": 315,
      "text": "<h4>Bars</h4>",
      "type": "text"
    },
    "barsarc": {
      "max": 360,
      "min": 0,
      "order": 360,
      "text": "Bars arc",
      "type": "slider",
      "value": 360
    },
    "barsheight": {
      "order": 350,
      "text": "<p>Max-Height multiplies basic bar height for all bars</p>",
      "type": "text"
    },
    "barsrotate": {
      "condition": "autobarsrotate.value == false",
      "max": 360,
      "min": 0,
      "order": 370,
      "text": "Rotate bars around the circle",
      "type": "slider",
      "value": 270
    },
    "barwidth": {
      "max": 40,
      "min": 1,
      "order": 340,
      "text": "Width",
      "type": "slider",
      "value": 1
    },
    "bassmultiplier": {
      "order": 1000,
      "text": "<h4>Bass Effect Multiplier</h4>",
      "type": "text"
    },
    "bassshakeclock": {
      "condition": "showclock.value",
      "order": 76,
      "text": "BassShake Clock",
      "type": "bool",
      "value": false
    },
    "bassshakemultiplier": {
      "max": 25,
      "min": 0,
      "order": 1001,
      "text": "Bass Shake",
      "type": "slider",
      "value": 12
    },
    "bassshaketext": {
      "condition": "showtext.value",
      "order": 166,
      "text": "BassShake Text",
      "type": "bool",
      "value": false
    },
    "bassshaketolerance": {
      "max": 100,
      "min": -100,
      "order": 1002,
      "text": "BassShake Tolerance!",
      "type": "slider",
      "value": 0
    },
    "bbassmultiplier": {
      "max": 800,
      "min": 0,
      "order": 1005,
      "text": "Bars bass",
      "type": "slider",
      "value": 80
    },
    "beattolerance": {
      "condition": "barcolortype.value == 3 || barcolortype.value == 4",
      "max": 50,
      "min": -50,
      "order": 328,
      "text": "Beat Tolerance%",
      "type": "slider",
      "value": 0
    },
    "blurclkvalue": {
      "condition": "showclock.value&&false",
      "max": 20,
      "min": 0,
      "order": 150,
      "text": "ShadowBlur - SET TO 0 FOR BEST PERFORMANCE",
      "type": "slider",
      "value": 0
    },
    "blurtxtvalue": {
      "condition": "showtext.value&&false",
      "max": 20,
      "min": 0,
      "order": 190,
      "text": "ShadowBlur - SET TO 0 FOR BEST PERFORMANCE",
      "type": "slider",
      "value": 0
    },
    "blurvalue": {
      "condition": "false",
      "max": 20,
      "min": 0,
      "order": 320,
      "text": "ShadowBlur - SET TO 0 FOR BEST PERFORMANCE",
      "type": "slider",
      "value": 0
    },
    "c1bassmultiplier": {
      "condition": "secondcircle.value",
      "max": 800,
      "min": 0,
      "order": 1013,
      "text": "Circle2 bass",
      "type": "slider",
      "value": 80
    },
    "cbassmultiplier": {
      "max": 800,
      "min": 0,
      "order": 1010,
      "text": "Circle bass",
      "type": "slider",
      "value": 80
    },
    "center": {
      "order": 280,
      "text": "<h4>Position</h4>",
      "type": "text"
    },
    "circle": {
      "order": 255,
      "text": "<h4>Circle2</h4>",
      "type": "text"
    },
    "circle1": {
      "order": 210,
      "text": "<h4>Circle</h4>",
      "type": "text"
    },
    "circlearc": {
      "max": 360,
      "min": 0,
      "order": 245,
      "text": "Circle Arc",
      "type": "slider",
      "value": 360
    },
    "circlecolor": {
      "condition": "logoimage.value == false",
      "order": 230,
      "text": "Color",
      "type": "color",
      "value": "1 1 1"
    },
    "circleopacity": {
      "condition": "logoimage.value==false",
      "max": 100,
      "min": 0,
      "order": 235,
      "text": "Opacity%",
      "type": "slider",
      "value": 100
    },
    "circleradius": {
      "max": 500,
      "min": 0,
      "order": 240,
      "text": "Radius",
      "type": "slider",
      "value": 64
    },
    "circlerotate": {
      "max": 360,
      "min": 0,
      "order": 250,
      "text": "Circle rotate degrees",
      "type": "slider",
      "value": 0
    },
    "clkbassmultiplier": {
      "condition": "showclock.value",
      "max": 640,
      "min": 0,
      "order": 1020,
      "text": "Clock bass",
      "type": "slider",
      "value": 80
    },
    "clock": {
      "order": 70,
      "text": "<h4>Clock/Text</h4>",
      "type": "text"
    },
    "clockcolor": {
      "condition": "showclock.value",
      "order": 140,
      "text": "Text Color",
      "type": "color",
      "value": "1 0 0"
    },
    "clockfont": {
      "condition": "showclock.value",
      "max": 20,
      "min": 1,
      "order": 130,
      "text": "Font",
      "type": "slider",
      "value": 1
    },
    "clockopacity": {
      "condition": "showclock.value",
      "max": 100,
      "min": 0,
      "order": 145,
      "text": "Opacity%",
      "type": "slider",
      "value": 100
    },
    "clockpositionx1": {
      "condition": "showclock.value",
      "max": 3000,
      "min": -3000,
      "order": 155,
      "text": "Clock Position X",
      "type": "slider",
      "value": 0
    },
    "clockpositiony1": {
      "condition": "showclock.value",
      "max": 3000,
      "min": -3000,
      "order": 160,
      "text": "Clock Position Y",
      "type": "slider",
      "value": 0
    },
    "clocksize": {
      "condition": "showclock.value",
      "max": 500,
      "min": 1,
      "order": 135,
      "text": "Font Size",
      "type": "slider",
      "value": 20
    },
    "eqpositionx": {
      "max": 3000,
      "min": -3000,
      "order": 290,
      "text": "Position X",
      "type": "slider",
      "value": 0
    },
    "eqpositiony": {
      "max": 3000,
      "min": -3000,
      "order": 300,
      "text": "Position Y",
      "type": "slider",
      "value": 0
    },
    "frameratepersecond": {
      "order": 1550,
      "text": "Show fps Warning(below 35)",
      "type": "bool",
      "value": true
    },
    "horizontal": {
      "condition": "backgroundimagef.value",
      "max": 3000,
      "min": -3000,
      "order": 510,
      "text": "PosX",
      "type": "slider",
      "value": 0
    },
    "hrmode": {
      "condition": "showclock.value",
      "order": 80,
      "text": "12 Hr Mode",
      "type": "bool",
      "value": false
    },
    "imageoptions1": {
      "condition": "backgroundimagef.value",
      "options": [
        {
          "label": "Initial",
          "value": 1
        },
        {
          "label": "Cover",
          "value": 2
        },
        {
          "label": "Contain",
          "value": 3
        }
      ],
      "order": 507,
      "text": "OverImageOptions",
      "type": "combo",
      "value": 2
    },
    "logoimage": {
      "order": 215,
      "text": "Logo[square]",
      "type": "file",
      "value": ""
    },
    "noise": {
      "order": 10,
      "text": "Noise",
      "type": "bool",
      "value": true
    },
    "normalize": {
      "order": 5,
      "text": "Normalize Audio",
      "type": "bool",
      "value": true
    },
    "overlay": {
      "order": 500,
      "text": "<h4>Overlay</h4>",
      "type": "text"
    },
    "particlecolor": {
      "condition": "particlerainbow.value == false",
      "order": 405,
      "text": "Color",
      "type": "color",
      "value": "1 1 1"
    },
    "particlenum": {
      "condition": "particlestyle.value == 1",
      "max": 25,
      "min": 0,
      "order": 420,
      "text": "no. of Particles",
      "type": "slider",
      "value": 2
    },
    "particlenumaudio": {
      "condition": "particlestyle.value == 1",
      "max": 25,
      "min": 0,
      "order": 425,
      "text": "Particles(no Audio)",
      "type": "slider",
      "value": 0
    },
    "particleopacity": {
      "condition": "particlestyle.value == 1",
      "max": 100,
      "min": 0,
      "order": 410,
      "text": "Opacity%",
      "type": "slider",
      "value": 100
    },
    "particleradius": {
      "max": 40,
      "min": 0,
      "order": 415,
      "text": "Size Multiplier",
      "type": "slider",
      "value": 0
    },
    "particlerainbow": {
      "condition": "particlestyle.value == 1",
      "order": 395,
      "text": "Rainbow Colors",
      "type": "bool",
      "value": false
    },
    "particles": {
      "order": 390,
      "text": "<h4>Particles</h4>",
      "type": "text"
    },
    "particlestyle": {
      "options": [
        {
          "label": "Style1",
          "value": 1
        },
        {
          "label": "Style2",
          "value": 2
        }
      ],
      "order": 391,
      "text": "Particle model",
      "type": "combo",
      "value": 1
    },
    "particlestyle2num": {
      "condition": "particlestyle.value == 2",
      "options": [
        {
          "label": "50",
          "value": 1
        },
        {
          "label": "100",
          "value": 2
        },
        {
          "label": "250",
          "value": 3
        },
        {
          "label": "500",
          "value": 4
        },
        {
          "label": "1000",
          "value": 5
        },
        {
          "label": "1500",
          "value": 6
        },
        {
          "label": "2000",
          "value": 7
        },
        {
          "label": "2500",
          "value": 8
        },
        {
          "label": "3000",
          "value": 9
        },
        {
          "label": "3500",
          "value": 10
        },
        {
          "label": "4000",
          "value": 11
        },
        {
          "label": "4500",
          "value": 12
        },
        {
          "label": "5000",
          "value": 13
        }
      ],
      "order": 420,
      "text": "no. of Particles",
      "type": "combo",
      "value": 2
    },
    "removecolon": {
      "condition": "showclock.value",
      "order": 125,
      "text": "Remove Colon Seperator",
      "type": "bool",
      "value": false
    },
    "resposive": {
      "max": 100,
      "min": 0,
      "order": 20,
      "text": "Responsiveness",
      "type": "slider",
      "value": 33
    },
    "reverseright": {
      "order": 15,
      "text": "Reverse Right bars",
      "type": "bool",
      "value": false
    },
    "schemecolor": {
      "order": 0,
      "text": "Scheme color",
      "type": "color",
      "value": "1 1 1"
    },
    "secondcircle": {
      "order": 260,
      "text": "Second Cirlce",
      "type": "bool",
      "value": true
    },
    "secondcirclecolor": {
      "condition": "secondcircle.value",
      "order": 265,
      "text": "Color",
      "type": "color",
      "value": "0 0 0"
    },
    "secondcircleopacity": {
      "condition": "secondcircle.value",
      "max": 100,
      "min": 0,
      "order": 270,
      "text": "Opacity%",
      "type": "slider",
      "value": 60
    },
    "secondcircleradius": {
      "condition": "secondcircle.value",
      "max": 153,
      "min": 0,
      "order": 275,
      "text": "Radius",
      "type": "slider",
      "value": 24
    },
    "showclock": {
      "order": 75,
      "text": "Show clock",
      "type": "bool",
      "value": false
    },
    "showday": {
      "condition": "showclock.value",
      "order": 105,
      "text": "Show Day",
      "type": "bool",
      "value": false
    },
    "showsecs": {
      "condition": "showclock.value",
      "order": 100,
      "text": "Show seconds",
      "type": "bool",
      "value": false
    },
    "showtext": {
      "order": 165,
      "text": "Show Text",
      "type": "bool",
      "value": false
    },
    "textcolor": {
      "condition": "showtext.value",
      "order": 180,
      "text": "Text Color",
      "type": "color",
      "value": "1 0 0"
    },
    "textfont": {
      "condition": "showtext.value",
      "max": 20,
      "min": 1,
      "order": 170,
      "text": "Front",
      "type": "slider",
      "value": 1
    },
    "textopacity": {
      "condition": "showtext.value",
      "max": 100,
      "min": 0,
      "order": 185,
      "text": "Opacity%",
      "type": "slider",
      "value": 100
    },
    "textpositionx": {
      "condition": "showtext.value",
      "max": 3000,
      "min": -3000,
      "order": 200,
      "text": "Text Position Y",
      "type": "slider",
      "value": 0
    },
    "textpositiony": {
      "condition": "showtext.value",
      "max": 3000,
      "min": -3000,
      "order": 205,
      "text": "Text Position X",
      "type": "slider",
      "value": 0
    },
    "textsize": {
      "condition": "showtext.value",
      "max": 500,
      "min": 1,
      "order": 175,
      "text": "Font Size",
      "type": "slider",
      "value": 25
    },
    "texttype": {
      "condition": "showclock.value && showday.value",
      "options": [
        {
          "label": "Normal",
          "value": 1
        },
        {
          "label": "Short Hand",
          "value": 2
        },
        {
          "label": "UserDefined",
          "value": 3
        }
      ],
      "order": 110,
      "text": "ShortHand day's",
      "type": "combo",
      "value": 1
    },
    "twinkling": {
      "condition": "particlerainbow.value && particlestyle.value == 1",
      "order": 400,
      "text": "Twinkling particles",
      "type": "bool",
      "value": false
    },
    "txtbassmultiplier": {
      "condition": "showtext.value",
      "max": 640,
      "min": 0,
      "order": 1015,
      "text": "Text bass",
      "type": "slider",
      "value": 80
    },
    "userdayposx": {
      "condition": "showclock.value && showday.value",
      "max": 3000,
      "min": -3000,
      "order": 115,
      "text": "Day text PositionX",
      "type": "slider",
      "value": 0
    },
    "userdayposy": {
      "condition": "showclock.value && showday.value",
      "max": 3000,
      "min": -3000,
      "order": 120,
      "text": "Day text PositionY",
      "type": "slider",
      "value": 0
    },
    "userhrposx": {
      "condition": "showclock.value && hrmode.value",
      "max": 3000,
      "min": -3000,
      "order": 85,
      "text": "am/pm PositionX",
      "type": "slider",
      "value": 0
    },
    "userhrposy": {
      "condition": "showclock.value && hrmode.value",
      "max": 3000,
      "min": -3000,
      "order": 90,
      "text": "am/pm PositionY",
      "type": "slider",
      "value": 0
    },
    "userrainbowrotate": {
      "condition": "barcolortype.value == 2",
      "max": 128,
      "min": 0,
      "order": 372,
      "text": "Rotate rainbow",
      "type": "slider",
      "value": 0
    },
    "userspectrumrotation": {
      "max": 128,
      "min": 0,
      "order": 371,
      "text": "Rotating audio Spectrum",
      "type": "slider",
      "value": 0
    },
    "vertical": {
      "condition": "backgroundimagef.value",
      "max": 3000,
      "min": -3000,
      "order": 520,
      "text": "PosY",
      "type": "slider",
      "value": 0
    }
  }
};
