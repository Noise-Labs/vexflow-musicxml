import Vex from 'vexflow';
import { Voice } from './Voice.js';
import { Key } from './Key.js';
import { ClefVisitor, KeyVisitor, TimeSignatureVisitor } from '../visitors/index';

const { Flow } = Vex;

export class Measure {
  constructor(xmlMeasure, format, ctx) {
    this.staveList = [];
    this.voiceList = [];
    this.connectors = [];
    this.xmlMeasure = xmlMeasure;
    this.context = ctx;
    this.format = format;
    // FIXME: The formatter should be available in all vex components
    this.formatter = new Flow.Formatter();
    // console.log(xmlMeasure.Attributes, xmlMeasure.Part);

    // TODO: Figure out a way to use the given width with a dynamic layout
    const width = format.staveWidth; // this.xmlMeasure.Width;
    this.width = document.body.clientWidth < width ? document.body.clientWidth : width;
    // Get the part we are in
    const part = this.xmlMeasure.Part - 1;
    // Get the absolute measure number
    const number = this.xmlMeasure.Number;
    // Calculate the line where this measure is on the page
    const lineOnPage = Math.ceil(number / format.measuresPerStave) - 1;

    this.firstInLine = (number - 1) % format.measuresPerStave === 0;
    const lastMeasure = number === format.totalMeasures;

    this.x = format.staveXOffset + (number - 1) % format.measuresPerStave * format.staveWidth;
    this.y = lineOnPage * format.systemSpace;

    const allStaves = xmlMeasure.getStaves();
    // FIXME: Time should be handled in Stave object
    const time = xmlMeasure.getTime() === undefined ? new Time(xmlMeasure.Node.parentNode.getElementsByTagName('time')[0]) : xmlMeasure.getTime();
    const clefs = xmlMeasure.getClefs();

    for (let s = 0; s < allStaves; s++) {
      const stave = s + 1;

      let staveClef = xmlMeasure.getClefsByStaff(stave);
      console.log(stave, staveClef)
      if (staveClef === undefined) {
        staveClef = 'treble';
      } else {
        staveClef = staveClef.accept(ClefVisitor);
      }

      // TODO: Separate formatter and converter into MeasureContainer and MeasureVisitor
      const flowStave = new Flow.Stave()
        .setContext(ctx)
        .setX(this.x)
        .setY(this.y + s * 100 + part * 100)
        .setWidth(this.width);

      if (this.firstInLine) {
        const key = xmlMeasure.Attributes.Key.accept(KeyVisitor);
        flowStave.addKeySignature(key);
      }
      if (JSON.stringify(this.xmlMeasure.StartClefs) !== JSON.stringify(this.xmlMeasure.lastMeasure.StartClefs)) {
        flowStave.addClef(staveClef);
      }
      this.staveList.push(flowStave);

      // console.log(xmlMeasure.toString(), xmlMeasure.Attributes.TimingChange, staveClef);
      const options = {
        ctx,
        formatter: this.formatter,
        stave,
        staveClef,
        flowStave,
        time: xmlMeasure.Attributes.Time,
      };
      const v = new Voice(xmlMeasure, options);
      this.voiceList.push(v);

      // Adding time signatures
      if (xmlMeasure.Number === 1 || xmlMeasure.Attributes.TimingChange) {
        flowStave.addTimeSignature(xmlMeasure.Attributes.Time.accept(TimeSignatureVisitor));
      }
    } // Staves
    this.addConnectors(this.firstInLine, lastMeasure);
  } // Constructor

  draw() {
    this.staveList.forEach(s => s.draw());
    this.voiceList.forEach(n => n.draw());
    this.connectors.forEach(c => c.draw());
  }

  addConnectors(firstInLine, lastMeasure) {
    if (this.staveList.length === 1 && lastMeasure) {
      this.staveList[0].setEndBarType(Flow.Barline.type.END);
    }
    for (let s = 0; s < this.staveList.length - 1; s++) {
      const firstStave = this.staveList[s];
      const secondStave = this.staveList[s + 1];
      // Beginning of system line
      if (firstInLine) {
        this.addConnector(firstStave, secondStave, Flow.StaveConnector.type.SINGLE_LEFT);
        this.addConnector(firstStave, secondStave, Flow.StaveConnector.type.BRACE);
      }
      // Every measure
      this.addConnector(firstStave, secondStave, Flow.StaveConnector.type.SINGLE_RIGHT);
      // End of score
      if (lastMeasure) {
        this.addConnector(firstStave, secondStave, Flow.StaveConnector.type.BOLD_DOUBLE_RIGHT);
      }
    }
  }

  /**
   * Adds a connector between two staves
   *
   * @param {Stave} stave1: First stave
   * @param {Stave} stave2: Second stave
   * @param {Flow.StaveConnector.type} type: Type of connector
   */
  addConnector(stave1, stave2, type) {
    this.connectors.push(new Flow.StaveConnector(stave1, stave2)
        .setType(type)
        .setContext(this.context));
  }
}
