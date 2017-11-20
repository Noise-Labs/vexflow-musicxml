/**
* @file
* @description Parser and renderer for Music XML files to Vex Flow
* @author {@link mailto:neumann.benni@gmail.com|neumann.benni@gmail.com}
* @version 0.1
*/

import Vex from 'vexflow';
import { MusicXml } from './xml/MusicXml.js';
import { Measure } from './vex/Measure.js';

const { Flow } = Vex;

/**
 * MusicXmlRenderer
 * @param
 */
export class MusicXmlRenderer {
  constructor(data, canvas) {
    this.musicXml = new MusicXml(data);
    console.log(this.musicXml);

    if (false) {
      const part = 1;
      const from = 1;
      const to = 2;
      this.musicXml.Parts = [this.musicXml.Parts[part]];
      this.musicXml.Parts[0].Measures = this.musicXml.Parts[0].Measures.slice(from, to);
    }
    this.mStartMeasure = 0;
    this.mStopMeasure = this.musicXml.Parts[0].Measures.length;

    this.isSvg = !(canvas instanceof HTMLCanvasElement);
    this.canvas = canvas;
    // eslint-disable-next-line max-len
    this.renderer = new Flow.Renderer(this.canvas, this.isSvg ? Flow.Renderer.Backends.SVG : Flow.Renderer.Backends.CANVAS);

    // Properties for rendering
    this.ctx = this.renderer.getContext();
    this.Drawables = [];

    // Some formatting constants
    this.staveSpace = 100;
    this.staveXOffset = 20;
    this.staveYOffset = 20;

    this.calculateLayout();

    console.time('parse');
    this.parse().render();
    console.timeEnd('parse');
  }

  getScoreHeight() {
    return this.systemSpace * this.format.linesPerPage;
  }

  // https://github.com/0xfe/vexflow/blob/1.2.83/tests/formatter_tests.js line 271
  parse() {
    const allParts = this.musicXml.Parts;
    for (const [p] of allParts.entries()) {
      const part = allParts[p];
      for (let m = this.mStartMeasure; m < this.mStopMeasure; m++) {
        const measure = part.Measures[m];
        this.Drawables.push(new Measure(measure, this.format, this.ctx));
      }
    }

    // Connect the first measures in a line
    const MeasuresFirstInLine = this.Drawables.filter(m => m.firstInLine);
    const MeasureNumsFirstInLine = new Set(MeasuresFirstInLine.map(m => m.xmlMeasure.Number));
    MeasureNumsFirstInLine.forEach((n) => {
      // Get all the measures from all parts with the same starting number.
      // Get their stavelist(s) and concatenate them in one array. Now we have an
      // array of staves that are in the first line.
      const system = [].concat(...MeasuresFirstInLine.filter(m => m.xmlMeasure.Number === n).map(m => m.staveList));
      for (let s = 0; s < system.length - 1; s++) {
        // It actually doesn't matter which measure we use for the connectors
        MeasuresFirstInLine[0].addConnector(system[s], system[s + 1], Flow.StaveConnector.type.SINGLE_LEFT);
      }
    });
    return this;
  }

  clear() {
    $(this.ctx.svg).empty();
  }

  set StartMeasure(value) {
    // TODO: Recalculate layout and rerender
    this.mStartMeasure = value;
    this.calculateLayout();
    this.Drawables = [];
    this.clear();
    this.parse().render();
  }

  set StopMeasure(value) {
    // TODO: Recalculate layout and rerender
    this.mStopMeasure = value;
    this.calculateLayout();
    this.clear();
    this.Drawables = [];
    this.parse().render();
  }

  calculateLayout() {
    this.stavesPerSystem = this.musicXml.Parts
      .map(p => p.getAllStaves()) // get all the staves in a part
      .reduce((e, ne) => e + ne);   // sum them up

    this.width = this.isSvg ? parseInt(this.canvas.getAttribute('width'), 10) : this.canvas.width;
    const startWidth = document.body.clientWidth < 250 ? document.body.clientWidth : 250;
    this.systemSpace = this.staveSpace * this.stavesPerSystem + 50;
    this.measuresPerStave = Math.floor(this.width / startWidth); // measures per stave
    this.staveWidth = Math.round(this.width / this.measuresPerStave) - this.staveXOffset;

    this.format = {
      staveSpace: this.staveSpace,
      staveXOffset: this.staveXOffset,
      staveYOffset: this.staveYOffset,
      systemSpace: this.systemSpace,
      // FIXME: Refactor to stavesPerMeasure
      measuresPerStave: this.measuresPerStave,
      totalMeasures: (this.mStopMeasure - this.mStartMeasure),
      staveWidth: this.staveWidth,
      stavesPerSystem: this.musicXml.getStavesPerSystem(),
      width: this.width,
      linesPerPage: Math.ceil((this.mStopMeasure - this.mStartMeasure) + 1 / this.measuresPerStave),
    };
    // Set the SVG viewbox according to the calculated layout
    const vb = [0, 0, this.width, this.getScoreHeight()];
    this.ctx.setViewBox(vb);
  }

  render() {
    this.Drawables.forEach(d => d.draw());
  }
}
