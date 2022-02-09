// ****************************************************************************
// coldpixelinterpolation.js - Released 02/05/2022
// Version: 0.1.2
// ****************************************************************************
// Copyright (c) 2022, Nagahiro and Astrodabo. All Rights Reserved.
// Website (nagahiro): https://snct-astro.hatenadiary.jp/archive
// Twitter (nagahiro): https://twitter.com/pochomskii
// Website (astrodabo): https://dabokun.github.io/
// Twitter (astrodabo): https://twitter.com/astrodabo
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// 3. All products derived from this software, in any form whatsoever, must
//    reproduce the following acknowledgment in the end-user documentation
//    and/or other materials provided with the product.
//
// 4. This product is based on software from the PixInsight project, developed
//    by Pleiades Astrophoto and its contributors (http://pixinsight.com/).
//
// 	  This file executes within the PixInsight JavaScript Runtime (PJSR).
// 	  PJSR is an ECMA-262 compliant framework for development of scripts on the
//    PixInsight platform.
//    Copyright (c) 2003-2020, Pleiades Astrophoto S.L. All Rights Reserved.
//
// THIS SOFTWARE IS PROVIDED BY NAGAHIRO AND ASTRODABO "AS IS" AND ANY EXPRESS OR IMPLIED
// WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
// IN NO EVENT SHALL NAGAHIRO AND ASTRODABO BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// BUSINESS INTERRUPTION; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; AND LOSS
// OF USE, DATA OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
// IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
// ****************************************************************************

/*
 * Cold Pixel Interpolation v0.1.2
 *
 * This script allows you to define a set of input calibrated light image files
 * (darks and flats are applied and not aligned),
 * cold sigma parameter, an optional output directory, and some output options.
 * The script then iterates reading each input file, stacks them. Then it replicates
 * stacked data and applies CosmeticCorrection to one side.
 * By taking the difference between these two images, a cool file is generated,
 * and it will be output on PixInsight.
 * Finally, the walking noise after stacking is greatly reduced by adding the
 * cool file to all the original light frames.
 * The stacked image, the stacked image with CosmeticCorrection applied, and the cold-pixel-corrected
 * light frames will be output to the specified directory (or to
 * the same directory as the first light frame if not specified), and the script
 * will terminate.

 *
 * Copyright (C) 2022 Nagahiro and Astrodabo
 *
 * Part of this file is based on BatchLinearFit.js
 * Copyright 2013 Pleiades Astrophoto S.L.
 */


#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/ImageOp.jsh>

#feature-id Utilities > ColdPixelInterpolation
#feature-info This script corrects cold pixels that are hard to remove simply applies CC process. <br> \
   This script allows you to define a set of input calibrated light image files \
   (darks and flats are applied and not aligned), \
   cold sigma parameter, an optional output directory, and some output options. <br> \
   The script then iterates reading each input file, stacks them. Then it replicates \
   stacked data and applies CosmeticCorrection to one side. <br> \
   By taking the difference between these two images, a cool file is generated, \
   and it will be output on PixInsight. <br> \
   Finally, the walking noise after stacking is greatly reduced by adding the \
   cool file to all the original light frames. <br> \
   The stacked image, the stacked image with CosmeticCorrection applied, and the cold-pixel-corrected \
   light frames will be output to the specified directory (or to \
   the same directory as the first light frame if not specified), and the script \
   will terminate. \
   <br><br> \
   Copyright (C) 2022 Nagahiro and Astrodabo \
   <br><br> \
   Part of this file is based on BatchLinearFit.js <br> \
   Copyright 2013 Pleiades Astrophoto S.L.

#define DEFAULT_OUTPUT_EXTENSION ".xisf"

#define VERSION "0.1.2"
#define TITLE   "Cold Pixel Interpolation"

var cpiParameters = {
   coldSigma: 0,
   targetView: undefined
};

function ColdPixelInterpolationEngine() {
   this.inputFiles = new Array;
   this.outputDirectory = "";
   this.outputPrefix = "";
   this.outputPostfixCC = "_cc";
   this.outputPostfix = "_cf";
   this.usingPostfix = "";
   this.stackedName = "stacked";
   this.outputExtension = DEFAULT_OUTPUT_EXTENSION;
   this.overwriteExisting = false;
   this.outputFormat = null;

   this.readImage = function (filePath) {
      var inputImageWindow = ImageWindow.open(filePath);

      return inputImageWindow[0];
   };

   this.writeImage = function (imageWindow, filePath) {
      var fileDir = (this.outputDirectory.length > 0) ? this.outputDirectory :
         File.extractDrive(filePath) + File.extractDirectory(filePath);
      if (!fileDir.endsWith('/'))
         fileDir += '/';
      var fileName = File.extractName(filePath);

      var outputFilePath = fileDir + this.outputPrefix + fileName + this.usingPostfix + this.outputExtension;
      console.writeln("<end><cbr><br>Output file:");

      if (File.exists(outputFilePath)) {
         if (this.overwriteExisting) {
            console.writeln("<end><cbr>** Overwriting existing file: " + outputFilePath);
         }
         else {
            console.writeln("<end><cbr>* File already exists: " + outputFilePath);
            for (var u = 1; ; ++u) {
               var tryFilePath = File.appendToName(outputFilePath, '_' + u.toString());
               if (!File.exists(tryFilePath)) {
                  outputFilePath = tryFilePath;
                  break;
               }
            }
            console.writeln("<end><cbr>* Writing to: <raw>" + outputFilePath + "</raw>");
         }
      }
      else {
         console.writeln("<raw>" + outputFilePath + "</raw>");
      }
      imageWindow.saveAs(outputFilePath, false, false, false, false);
   };

   this.coldPixelInterpolationFiles = function () {
      var currentImage = null;
      var stackedImage = null;
      var directory = null;
      for (var i = 0; i < this.inputFiles.length; ++i) {
         currentImage = this.readImage(this.inputFiles[i]);
         if (i == 0) {
            directory = (this.outputDirectory.length > 0) ? this.outputDirectory :
               File.extractDrive(this.inputFiles[i]) + File.extractDirectory(this.inputFiles[i]);
         }
         if (stackedImage == null) {
            stackedImage = new Image(currentImage.mainView.image.width, currentImage.mainView.image.height);
         }
         currentImage.mainView.beginProcess();
         var image = currentImage.mainView.image;
         //stacking
         image.apply(this.inputFiles.length, ImageOp_Div); //divide current image
         stackedImage.apply(image, ImageOp_Add);           //and add!
         currentImage.mainView.endProcess();
         currentImage.forceClose();
      }

      //Convert to ImageWindow Object
      var stackedImageWin = new ImageWindow(stackedImage.width, stackedImage.height);
      stackedImageWin.mainView.beginProcess();
      stackedImageWin.mainView.image.assign(stackedImage);
      stackedImageWin.mainView.endProcess();


      stackedImagePath = directory + "/" + this.stackedName + ".xisf";
      var stackedImagePath_actual = stackedImagePath;
      if (!this.overwriteExisting) {
         if (File.exists(stackedImagePath)) {
            for (var u = 1; ; ++u) {
               var tryFilePath = File.appendToName(stackedImagePath, '_' + u.toString());
               if (!File.exists(tryFilePath)) {
                  stackedImagePath_actual = tryFilePath;
                  break;
               }
            }
         }
      }
      this.usingPostfix = "";

      //Output stacked imaged to input for CosmeticCorrection
      this.writeImage(stackedImageWin, stackedImagePath);

      //CC Process
      var cc_process = new CosmeticCorrection;
      this.usingPostfix = this.outputPostfixCC;
      var stackedImageCCPath = File.appendToName(stackedImagePath_actual, this.usingPostfix);
      var stackedImageCCPath_actual = stackedImageCCPath;
      if (!this.overwriteExisting) {
         if (File.exists(stackedImageCCPath)) {
            for (var u = 1; ; ++u) {
               var tryFilePath = File.appendToName(stackedImageCCPath, '_' + u.toString());
               if (!File.exists(tryFilePath)) {
                  stackedImageCCPath_actual = tryFilePath;
                  break;
               }
            }
         }
      }
      with (cc_process) {
         targetFrames = [[true, stackedImagePath_actual]];
         masterDarkPath = "";
         outputDir = "";
         outputExtension = ".xisf";
         prefix = "";
         postfix = this.usingPostfix;
         overwrite = this.overwriteExisting;
         cfa = true;
         useMasterDark = false;
         hotDarkCheck = false;
         hotDarkLevel = 1.0000000;
         coldDarkCheck = false;
         coldDarkLevel = 0.0000000;
         useAutoDetect = true;
         hotAutoCheck = false;
         hotAutoValue = 3.0;
         coldAutoCheck = true;
         coldAutoValue = cpiParameters.coldSigma;
         amount = 1.00;
         useDefectList = false;
         defects = [];
         executeGlobal();
      }

      //Read CC-ed image
      var stackedCCImageWin = this.readImage(stackedImageCCPath_actual);

      //Create Cool File
      var coolImage = new ImageWindow(stackedCCImageWin.width, stackedCCImageWin.height);
      coolImage.mainView.beginProcess();
      coolImage.mainView.image.assign(stackedCCImageWin.mainView.image);
      coolImage.mainView.image.apply(stackedImageWin.mainView.image, ImageOp_Sub);
      coolImage.mainView.endProcess();
      coolImage.mainView.id = "Cool_Image";
      coolImage.show();
      stackedImageWin.forceClose();
      stackedCCImageWin.forceClose();

      //Apply Cool File to original light frames
      var directory = null;
      this.usingPostfix = this.outputPostfix;
      for (var i = 0; i < this.inputFiles.length; ++i) {
         currentImage = this.readImage(this.inputFiles[i]);
         if (i == 0) {
            directory = (this.outputDirectory.length > 0) ? this.outputDirectory :
               File.extractDrive(this.inputFiles[i]) + File.extractDirectory(this.inputFiles[i]);
            directory += "/corrected";
            if (!File.directoryExists(directory)) {
               File.createDirectory(directory);
            }
         }
         currentImage.mainView.beginProcess();
         var image = currentImage.mainView.image;
         image.apply(coolImage.mainView.image, ImageOp_Add);
         currentImage.mainView.endProcess();
         var fileName = File.extractName(this.inputFiles[i]);
         var outPath = directory + "/" + fileName;
         this.writeImage(currentImage, outPath);
         currentImage.forceClose();
      }

   }
}

var engine = new ColdPixelInterpolationEngine;


function CPI_dialog() {
   this.__base__ = Dialog;
   this.__base__();

   this.minWidth = 550;
   this.minHeight = 635;
   var labelWidth1 = this.font.width( "Output format hints:" + 'T' );
   this.textEditWidth = 25 * this.font.width( "M" );
   this.numericEditWidth = 6 * this.font.width( "0" );

   //title show
   this.title = new TextBox(this);
   this.title.text = "<b>" + TITLE + " v" + VERSION + "</b><br><br>" +
      "&nbsp;a script removes cold pixels<br>" +
      "&nbsp;&nbsp;invented by apranat (Twitter: @PG1wvzio4yvwFXW)<br>" +
      "&nbsp;&nbsp;implemented by astrodabo (Twitter: @astrodabo) and nagahiro (Twitter: @pochomskii) <br>" +
      "now under construction! ";
   this.title.readOnly = true;
   this.title.backgoundColor = 0x333333ff;
   this.title.minHeight = 120;
   this.title.maxHeight = 120;

   //show file list
   this.files_TreeBox = new TreeBox(this);
   this.files_TreeBox.multipleSelection = true;
   this.files_TreeBox.rootDecoration = false;
   this.files_TreeBox.alternateRowColor = true;
   this.files_TreeBox.setScaledMinSize(300, 200);
   this.files_TreeBox.numberOfColumns = 1;
   this.files_TreeBox.headerVisible = false;

   for (var i = 0; i < engine.inputFiles.length; ++i) {
      var node = new TreeBoxNode(this.files_TreeBox);
      node.setText(0, engine.inputFiles[i]);
   }

   this.filesAdd_Button = new PushButton(this);
   this.filesAdd_Button.text = "Add";
   this.filesAdd_Button.icon = this.scaledResource(":/icons/add.png");
   this.filesAdd_Button.toolTip = "<p>Add image files to the input images list.</p>" +
   "<p>Specify images that have been calibrated and NOT yet aligned." ;
   this.filesAdd_Button.onClick = function () {
      var ofd = new OpenFileDialog;
      ofd.multipleSelections = true;
      ofd.caption = "Select Images";
      ofd.loadImageFilters();

      if (ofd.execute()) {
         this.dialog.files_TreeBox.canUpdate = false;
         for (var i = 0; i < ofd.fileNames.length; ++i) {
            var node = new TreeBoxNode(this.dialog.files_TreeBox);
            node.setText(0, ofd.fileNames[i]);
            engine.inputFiles.push(ofd.fileNames[i]);
         }
         this.dialog.files_TreeBox.canUpdate = true;
      }
   };

   this.filesClear_Button = new PushButton(this);
   this.filesClear_Button.text = "Clear";
   this.filesClear_Button.icon = this.scaledResource(":/icons/clear.png");
   this.filesClear_Button.tooltip = "<p>Clear the list of input images.</p>";
   this.filesClear_Button.onClick = function () {
      this.dialog.files_TreeBox.clear();
      engine.inputFiles.length = 0;
   };

   this.filesInvert_Button = new PushButton(this);
   this.filesInvert_Button.text = "Invert Selection";
   this.filesInvert_Button.icon = this.scaledResource(":/icons/select-invert.png");
   this.filesInvert_Button.tooltip = "<p>Invert the current selection of input images.</p>";
   this.filesInvert_Button.onClick = function () {
      for (var i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i)
         this.dialog.files_TreeBox.child(i).selected =
            !this.dialog.files_TreeBox.child(i).selected;
   };

   this.filesRemove_Button = new PushButton(this);
   this.filesRemove_Button.text = "Remove Selected";
   this.filesRemove_Button.icon = this.scaledResource(":/icons/delete.png");
   this.filesRemove_Button.tooltip = "<p>Remove all selected images from the input images list.</p>";
   this.filesRemove_Button.onClick = function () {
      engine.inputFiles.length = 0;
      for (var i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i)
         if (!this.dialog.files_TreeBox.child(i).selected)
            engine.inputFiles.push(this.dialog.files_TreeBox.child(i).text(0));
      for (var i = this.dialog.files_TreeBox.numberOfChildren; --i >= 0;)
         if (this.dialog.files_TreeBox.child(i).selected)
            this.dialog.files_TreeBox.remove(i);
   };

   this.filesButtons_Sizer = new HorizontalSizer;
   this.filesButtons_Sizer.spacing = 4;
   this.filesButtons_Sizer.add(this.filesAdd_Button);
   this.filesButtons_Sizer.addStretch();
   this.filesButtons_Sizer.add(this.filesClear_Button);
   this.filesButtons_Sizer.addStretch();
   this.filesButtons_Sizer.add(this.filesInvert_Button);
   this.filesButtons_Sizer.add(this.filesRemove_Button);

   this.files_GroupBox = new GroupBox( this );
   this.files_GroupBox.title = "Input Images";
   this.files_GroupBox.sizer = new VerticalSizer;
   this.files_GroupBox.sizer.margin = 6;
   this.files_GroupBox.sizer.spacing = 4;
   this.files_GroupBox.sizer.add( this.files_TreeBox, 25 * this.font.width( "M" ) );
   this.files_GroupBox.sizer.add( this.filesButtons_Sizer );

   //numerical
   this.setAmount = new NumericControl(this);
   this.setAmount.label.text = "Cold sigma"
   this.setAmount.toolTip = "<p>The threshold to detect cold pixels. Set this zero for the first.</p>" +
   "Try slightly larger value to avoid over detection of cold pixels. ";
   this.setAmount.setRange(0, 1);
   this.setAmount.setPrecision(2);
   this.setAmount.slider.setRange(0, 100);
   this.setAmount.onValueUpdated = function (value) {
      cpiParameters.coldSigma = value;
   }

   this.params_GroupBox = new GroupBox( this );
   this.params_GroupBox.title = "CPI Parameters";
   this.params_GroupBox.sizer = new VerticalSizer;
   this.params_GroupBox.sizer.margin = 6;
   this.params_GroupBox.sizer.spacing = 4;
   this.params_GroupBox.sizer.add( this.setAmount );

   //execute button
   this.execButton = new PushButton(this);
   this.execButton.text = "EXECUTE";
   this.execButton.width = 40;
   this.execButton.onClick = () => {
      if (engine.inputFiles.length == 0) {
         Console.writeln("Specify input files.");
      } else {
         engine.coldPixelInterpolationFiles();
         this.ok();
      }
   }

   //add cread instance botton
   this.newInstanceButton = new ToolButton(this);
   this.newInstanceButton.icon = this.scaledResource(":/process-interface/new-instance.png");
   this.newInstanceButton.setScaledFixedSize(24, 24);

   //directory name
   this.outputDir_Edit = new Edit( this );
   this.outputDir_Edit.readOnly = true;
   this.outputDir_Edit.text = engine.outputDirectory;
   this.outputDir_Edit.toolTip =
      "<p>If specified, all converted images will be written to the output directory.</p>" +
      "<p>If not specified, converted images will be written to the same directories " +
      "of their corresponding input images.</p>";

   this.outputDirSelect_Button = new ToolButton( this );
   this.outputDirSelect_Button.icon = this.scaledResource( ":/browser/select-file.png" );
   this.outputDirSelect_Button.setScaledFixedSize( 20, 20 );
   this.outputDirSelect_Button.toolTip = "<p>Select the output directory.</p>";
   this.outputDirSelect_Button.onClick = function()
   {
      var gdd = new GetDirectoryDialog;
      gdd.initialPath = engine.outputDirectory;
      gdd.caption = "Select Output Directory";

      if ( gdd.execute() )
      {
         engine.outputDirectory = gdd.directory;
         this.dialog.outputDir_Edit.text = engine.outputDirectory;
      }
   };

   this.outputDir_Label = new Label( this );
   this.outputDir_Label.text = "Output Directory:";
   this.outputDir_Label.minWidth = labelWidth1;
   this.outputDir_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.outputDir_Sizer = new HorizontalSizer;
   this.outputDir_Sizer.spacing = 4;
   this.outputDir_Sizer.add( this.outputDir_Label );
   this.outputDir_Sizer.add( this.outputDir_Edit, this.textEditWidth );
   this.outputDir_Sizer.add( this.outputDirSelect_Button );

   this.stackedName_Label = new Label (this);
   this.stackedName_Label.text = "Stacked Filename:";
   this.stackedName_Label.textAlignment = TextAlign_Right;

   this.stackedName = new Edit( this );
   this.stackedName.readOnly = false;
   this.stackedName.text = engine.stackedName;
   this.stackedName.toolTip = "";
   this.stackedName.onEditCompleted = function () {
      engine.stackedName = this.text;
   }


   //postfix
   this.outputPostfixCC_Label = new Label (this);
   this.outputPostfixCC_Label.text = "PostfixCC:";
   this.outputPostfixCC_Label.textAlignment = TextAlign_Right;

   this.outputPostfixCC_Edit = new Edit( this );
   this.outputPostfixCC_Edit.text = engine.outputPostfixCC;
   this.outputPostfixCC_Edit.setFixedWidth( this.font.width( "MMMMMM" ) );
   this.outputPostfixCC_Edit.toolTip = "";
   this.outputPostfixCC_Edit.onEditCompleted = function()
   {
      engine.outputPostfixCC = this.text;
   };

   this.outputPostfix_Label = new Label (this);
   this.outputPostfix_Label.text = "Postfix:";
   this.outputPostfix_Label.textAlignment = TextAlign_Right;

   this.outputPostfix_Edit = new Edit( this );
   this.outputPostfix_Edit.text = engine.outputPostfix;
   this.outputPostfix_Edit.setFixedWidth( this.font.width( "MMMMMM" ) );
   this.outputPostfix_Edit.toolTip = "";
   this.outputPostfix_Edit.onEditCompleted = function()
   {
      engine.outputPostfix = this.text;
   };

   this.bottomSizer = new HorizontalSizer;
   this.bottomSizer.margin = 8;
   this.bottomSizer.add(this.newInstanceButton);
   this.bottomSizer.addStretch();
   this.bottomSizer.add(this.execButton);

   this.postfixSizer = new HorizontalSizer;
   this.postfixSizer.margin = 8;
   this.postfixSizer.spacing = 4;
   this.postfixSizer.add(this.stackedName_Label);
   this.postfixSizer.add(this.stackedName);
   this.postfixSizer.add(this.outputPostfixCC_Label);
   this.postfixSizer.add(this.outputPostfixCC_Edit);
   this.postfixSizer.add(this.outputPostfix_Label);
   this.postfixSizer.add(this.outputPostfix_Edit);


   this.isoverwrite = new CheckBox(this);
   this.isoverwrite.checked = engine.overwriteExisting;
   this.isoverwrite.text = "Over write"
   this.isoverwrite.tooltip = "Overwrite any output files associated with this script, if they exist.";
   this.isoverwrite.onCheck = function(t) {
      engine.overwriteExisting = t;
   };

   this.overwriteSizer = new HorizontalSizer;
   this.overwriteSizer.setAlignment(this.overwriteSizer, Align_Right);
   this.overwriteSizer.margin = 8;
   this.overwriteSizer.add(this.isoverwrite);

   this.output_GroupBox = new GroupBox( this );
   this.output_GroupBox.title = "Output Options";
   this.output_GroupBox.sizer = new VerticalSizer;
   this.output_GroupBox.sizer.margin = 6;
   this.output_GroupBox.sizer.spacing = 4;
   this.output_GroupBox.sizer.add( this.outputDir_Sizer );
   this.output_GroupBox.sizer.add( this.postfixSizer );
   this.output_GroupBox.sizer.add( this.overwriteSizer );




   //size
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.add(this.title);
   this.sizer.addSpacing(8);
   this.sizer.add(this.files_GroupBox);
   this.sizer.addSpacing(8);
   this.sizer.add(this.params_GroupBox);
   this.sizer.addSpacing(8);
   this.sizer.add(this.output_GroupBox);
   this.sizer.add(this.bottomSizer);
   this.sizer.addStretch();

}

CPI_dialog.prototype = new Dialog;

function showDialog() {
   let dialog = new CPI_dialog;
   return dialog.execute();
}

function main() {
   let retVal = showDialog();

   if (retVal == 1) {
      //perform
      Console.writeln("CPI script finished");
   } else {
      //cancelled
      Console.writeln("Cancelled");
   }


}

main();
