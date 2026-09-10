import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import GovernanceFactor, {
  Principle,
  Problem,
  Characteristics,
  PositiveExamples,
  NegativeExamples,
  AntiPatterns,
  Diagram,
  Discussion,
  RelatedFactors,
  References,
} from '@site/src/components/GovernanceFactor';
import GovernanceArtifact, {
  Purpose,
  Role,
  Examples,
  LinksUpstream,
  LinksDownstream,
  EntityRelationshipDiagram,
} from '@site/src/components/GovernanceArtifact';
import FactorList from '@site/src/components/FactorList';
import RevealItem from '@site/src/components/RevealItem';
import CodeExample, {Output, Outputs} from '@site/src/components/CodeExample';
import BandPill from '@site/src/components/BandPill';
import ArtifactLayerMap from '@site/src/components/ArtifactLayerMap';
import Tool, {HelpsWith} from '@site/src/components/Tool';
import ToolList from '@site/src/components/ToolList';
import GemaraGuidance from '@site/src/components/GemaraGuidance';
import GemaraCatalog from '@site/src/components/GemaraCatalog';
import Comparison, {
  Requirement,
  AddressedBy,
  Gap,
  Recommendation,
} from '@site/src/components/Comparison';

export default {
  ...MDXComponents,
  GovernanceFactor,
  Principle,
  Problem,
  Characteristics,
  PositiveExamples,
  NegativeExamples,
  AntiPatterns,
  Diagram,
  Discussion,
  RelatedFactors,
  References,
  GovernanceArtifact,
  Purpose,
  Role,
  Examples,
  LinksUpstream,
  LinksDownstream,
  EntityRelationshipDiagram,
  FactorList,
  RevealItem,
  CodeExample,
  Outputs,
  Output,
  BandPill,
  ArtifactLayerMap,
  Tool,
  HelpsWith,
  ToolList,
  GemaraGuidance,
  GemaraCatalog,
  Comparison,
  Requirement,
  AddressedBy,
  Gap,
  Recommendation,
};
