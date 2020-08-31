import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";

import {
  ArrowDropDown,
  Check,
  Close,
  Fullscreen,
  FullscreenExit,
} from "@material-ui/icons";
import { useRecoilState, useRecoilValue } from "recoil";

import JSONView from "./JSONView";
import Player51 from "./Player51";
import Tag from "./Tags/Tag";
import { Button, ModalFooter } from "./utils";
import * as selectors from "../recoil/selectors";
import * as atoms from "../recoil/atoms";
import Filter from "./Filter";
import { Body } from "./CheckboxGrid";
import DisplayOptionsSidebar from "./DisplayOptionsSidebar";

import { useKeydownHandler, useResizeHandler } from "../utils/hooks";
import { formatMetadata, makeLabelNameGroups } from "../utils/labels";

type Props = {
  sample: object;
  sampleUrl: string;
};

const Container = styled(Body)`
  display: grid;
  grid-template-columns: 280px auto;
  width: 90vw;
  height: 80vh;
  background-color: ${({ theme }) => theme.background};

  &.fullscreen {
    width: 100vw;
    height: 100vh;
    grid-template-columns: auto;
    .sidebar {
      display: none;
    }
  }

  h2 {
    clear: both;
  }

  h2,
  h2 span {
    display: flex;
    align-items: center;
  }

  h2 .push-right {
    margin-left: auto;
  }

  h2 svg {
    cursor: pointer;
    margin-left: 5px;
  }

  h2 .close-wrapper {
    position: absolute;
    top: 1em;
    right: 1em;
    background-color: ${({ theme }) => theme.backgroundTransparent};
  }

  .player {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    .p51-video-options-panel {
      z-index: 1500;
    }
  }

  .top-right-nav-buttons {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    height: 5em;
    font-size: 150%;
    font-weight: bold;
    user-select: none;

    & > svg {
      height: 2em;
    }
  }

  .nav-button {
    position: absolute;
    z-index: 1000;
    top: 50%;
    width: 2em;
    height: 5em;
    margin-top: -2.5em;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: ${({ theme }) => theme.overlayButton};
    cursor: pointer;
    font-size: 150%;
    font-weight: bold;
    user-select: none;

    &.left {
      left: 0;
    }
    &.right {
      right: 0;
    }
  }

  .sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    border-right: 2px solid ${({ theme }) => theme.border};
    max-height: 100%;
    overflow-y: auto;

    .sidebar-content {
      padding-left: 1em;
      padding-right: 1em;
      padding-bottom: 1em;
      flex-grow: 1;
      overflow-y: auto;
    }
    .sidebar-content::-webkit-scrollbar {
      width: 0px;
      background: transparent;
      display: none;
    }
    .sidebar-content::-webkit-scrollbar-thumb {
      width: 0px;
      display: none;
    }

    ${ModalFooter} {
      align-items: flex-start;
    }
  }

  .row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    flex-wrap: wrap;

    > label {
      font-weight: bold;
      display: block;
      padding-right: 0.5rem;
      width: auto;
    }
    > div {
      display: block;
      max-width: 100%;
    }
    span {
      flex-grow: 2;
      overflow-wrap: break-word;
      vertical-align: middle;
    }
  }
`;

const TopRightNavButtonsContainer = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
`;

const TopRightNavButtons = ({ children }) => {
  return <TopRightNavButtonsContainer>{children}</TopRightNavButtonsContainer>;
};

const TopRightNavButtonContainer = styled.div`
  display: block;
  background-color: ${({ theme }) => theme.overlayButton};
  cursor: pointer;
  font-size: 150%;
  font-weight: bold;
  user-select: none;
  width: 2em;
  margin-top: 0;
  height: 2em;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TopRightNavButton = ({ icon, title, onClick }) => {
  return (
    <TopRightNavButtonContainer title={title} onClick={onClick}>
      {icon}
    </TopRightNavButtonContainer>
  );
};

const Row = ({ name, renderedName, value, children, ...rest }) => (
  <div className="row" {...rest}>
    <label>{renderedName || name}&nbsp;</label>
    <div>
      <span>{value}</span>
    </div>
    {children}
  </div>
);

const LabelRow = ({ color, field, ...rest }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeLabels, setActiveLabels] = useRecoilState(
    atoms.modalActiveLabels
  );
  return (
    <React.Fragment key={rest.key}>
      <Row {...rest}>
        {activeLabels[rest.name] && field._cls && (
          <ArrowDropDown
            onClick={(e) => {
              e.preventDefault();
              setExpanded(!expanded);
            }}
            style={{
              lineHeight: "31px",
              cursor: "pointer",
            }}
          />
        )}
      </Row>
      {expanded && activeLabels[rest.name] && (
        <Filter
          key={`${rest.key}-filter`}
          style={{
            margin: "0.5rem 0",
            border: "1px solid hsl(200,2%,37%)",
          }}
          entry={{
            name: rest.name,
            color,
            selected: activeLabels[rest.name],
          }}
          {...{
            includeLabels: atoms.modalFilterIncludeLabels,
            invertInclude: atoms.modalFilterInvertIncludeLabels,
            includeNoConfidence: atoms.modalFilterLabelIncludeNoConfidence,
            confidenceRange: atoms.modalFilterLabelConfidenceRange,
          }}
        />
      )}
    </React.Fragment>
  );
};

const SampleModal = ({
  sample,
  sampleUrl,
  colorMap = {},
  onClose,
  onPrevious,
  onNext,
  ...rest
}: Props) => {
  const playerContainerRef = useRef();
  const [playerStyle, setPlayerStyle] = useState({ height: "100%" });
  const [showJSON, setShowJSON] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeLabels, setActiveLabels] = useRecoilState(
    atoms.modalActiveLabels
  );
  const [activeTags, setActiveTags] = useRecoilState(atoms.modalActiveTags);
  const tagNames = useRecoilValue(selectors.tagNames);

  const [activeOther, setActiveOther] = useRecoilState(atoms.modalActiveOther);
  const fieldSchema = useRecoilValue(selectors.fieldSchema);
  const labelNames = useRecoilValue(selectors.labelNames);
  const labelTypes = useRecoilValue(selectors.labelTypes);
  const labelNameGroups = makeLabelNameGroups(
    fieldSchema,
    labelNames,
    labelTypes
  );
  useEffect(() => {
    setActiveLabels(rest.activeLabels);
  }, [rest.activeLabels]);

  const handleResize = () => {
    if (!playerContainerRef.current || showJSON) {
      return;
    }
    const container = playerContainerRef.current;
    const image = playerContainerRef.current.querySelector(
      "img.p51-contained-image"
    );
    const containerRatio = container.clientWidth / container.clientHeight;
    const imageRatio = image.clientWidth / image.clientHeight;
    if (containerRatio < imageRatio) {
      setPlayerStyle({
        width: container.clientWidth,
        height: container.clientWidth / imageRatio,
      });
    } else {
      setPlayerStyle({
        height: container.clientHeight,
        width: container.clientHeight * imageRatio,
      });
    }
  };

  useResizeHandler(handleResize, [showJSON]);
  useEffect(handleResize, [showJSON, fullscreen]);

  useKeydownHandler(
    (e) => {
      if (e.key == "Escape") {
        if (fullscreen) {
          setFullscreen(false);
        } else if (onClose) {
          onClose();
        }
      } else if (e.key == "ArrowLeft" && onPrevious) {
        onPrevious();
      } else if (e.key == "ArrowRight" && onNext) {
        onNext();
      }
    },
    [onClose, onPrevious, onNext, fullscreen]
  );

  const getDisplayOptions = (values, countOrExists, selected) => {
    return [...values].sort().map(({ name, type }) => ({
      name,
      type,
      icon:
        typeof countOrExists[name] === "boolean" ? (
          countOrExists[name] ? (
            <Check />
          ) : (
            <Close />
          )
        ) : undefined,
      count: countOrExists[name],
      selected: Boolean(selected[name]),
    }));
  };

  const handleSetDisplayOption = (setSelected) => (entry) => {
    setSelected((selected) => ({
      ...selected,
      [entry.name]: entry.selected,
    }));
  };

  const tagSampleExists = tagNames.reduce(
    (acc, tag) => ({
      ...acc,
      [tag]: sample.tags.includes(tag),
    }),
    {}
  );

  const labelSampleValues = labelNameGroups.labels.reduce((obj, label) => {
    let value;
    if (!sample[label]) {
      value = false;
    } else {
      const type = sample[label].type;
      value = ["Detections", "Classifcations"].includes(type)
        ? sample[label][type.toLowerCase()].length
        : true;
    }
    return {
      ...obj,
      [label]: value,
    };
  }, {});

  const scalarSampleValues = labelNameGroups.labels.reduce((obj, label) => {
    let value;
    if (!sample[label]) {
      value = false;
    } else {
      const type = sample[label].type;
      value = ["Detections", "Classifcations"].includes(type)
        ? sample[label][type.toLowerCase()].length
        : true;
    }
    return {
      ...obj,
      [label]: value,
    };
  }, {});

  const otherSampleValues = labelNameGroups.unsupported.reduce((obj, label) => {
    return {
      ...obj,
      [label]: label in sample,
    };
  }, {});

  return (
    <Container className={fullscreen ? "fullscreen" : ""}>
      <div className="sidebar">
        <div className="sidebar-content">
          <h2>
            Metadata
            <span className="push-right" />
          </h2>
          <Row name="ID" value={sample._id.$oid} />
          <Row name="Source" value={sample.filepath} />
          {formatMetadata(sample.metadata).map(({ name, value }) => (
            <Row key={"metadata-" + name} name={name} value={value} />
          ))}
          <DisplayOptionsSidebar
            colorMap={colorMap}
            tags={getDisplayOptions(
              tagNames.map((t) => ({ name: t })),
              tagSampleExists,
              activeTags
            )}
            labels={getDisplayOptions(
              labelNameGroups.labels,
              labelSampleValues,
              activeLabels
            )}
            onSelectLabel={handleSetDisplayOption(setActiveLabels)}
            scalars={getDisplayOptions(
              labelNameGroups.scalars,
              scalarSampleValues,
              activeLabels
            )}
            onSelectScalar={handleSetDisplayOption(setActiveLabels)}
            unsupported={getDisplayOptions(
              labelNameGroups.unsupported,
              otherSampleValues,
              activeLabels
            )}
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              height: "auto",
            }}
          />
        </div>
        <ModalFooter>
          <Button onClick={() => setShowJSON(!showJSON)}>
            {showJSON ? "Hide" : "Show"} JSON
          </Button>
        </ModalFooter>
      </div>
      <div className="player" ref={playerContainerRef}>
        {showJSON ? (
          <JSONView object={sample} />
        ) : (
          <Player51
            key={sampleUrl} // force re-render when this changes
            src={sampleUrl}
            onLoad={handleResize}
            style={{
              position: "relative",
              ...playerStyle,
            }}
            sample={sample}
            colorMap={colorMap}
            activeLabels={activeLabels}
            fieldSchema={fieldSchema}
            filterSelector={selectors.modalLabelFilters}
          />
        )}
        {onPrevious ? (
          <div
            className="nav-button left"
            onClick={onPrevious}
            title="Previous sample (Left arrow)"
          >
            &lt;
          </div>
        ) : null}
        {onNext ? (
          <div
            className="nav-button right"
            onClick={onNext}
            title="Next sample (Right arrow)"
          >
            &gt;
          </div>
        ) : null}
        <TopRightNavButtons>
          <TopRightNavButton
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Unmaximize (Esc)" : "Maximize"}
            icon={fullscreen ? <FullscreenExit /> : <Fullscreen />}
          />
          <TopRightNavButton
            onClick={onClose}
            title={"Close"}
            icon={<Close />}
          />
        </TopRightNavButtons>
      </div>
    </Container>
  );
};

export default SampleModal;
