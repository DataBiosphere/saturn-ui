import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { azureRuntime, getAzureDisk, getDisk, getRuntimeConfig } from 'src/analysis/_testData/testData';
import { DeleteDiskChoices } from 'src/analysis/modals/DeleteDiskChoices';
import { DeleteEnvironment } from 'src/analysis/modals/DeleteEnvironment';
import { runtimeToolLabels } from 'src/analysis/utils/tool-utils';
import { ButtonPrimary } from 'src/components/common';
import { cloudServiceTypes } from 'src/libs/ajax/leonardo/models/runtime-config-models';
import { formatUSD } from 'src/libs/utils';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

const renderActionButton = () => h(ButtonPrimary, {}, ['Delete']);

describe('DeleteDiskChoices', () => {
  it.each([{ cloudService: cloudServiceTypes.GCE }, { cloudService: cloudServiceTypes.AZURE_VM }])(
    'Should pass through all correct values',
    ({ cloudService }) => {
      // Arrange
      const pdCost = formatUSD(1.01);
      const deleteDiskSelected = false;
      const setDeleteDiskSelected = jest.fn();

      // Act
      render(
        h(DeleteDiskChoices, {
          persistentDiskCostDisplay: pdCost,
          toolLabel: 'RStudio',
          cloudService,
          deleteDiskSelected,
          setDeleteDiskSelected,
        })
      );

      // Assert
      screen.getByText('Keep persistent disk, delete application configuration and compute profile');
      screen.getByText('/home/rstudio');
      screen.getByText(`${pdCost} per month.`);
      screen.getByText('Delete everything, including persistent disk');
    }
  );

  it('Should be able to toggle setDeleteDiskSelected when option pressed', async () => {
    // Arrange
    const pdCost = formatUSD(1.01);
    const deleteDiskSelected = false;
    const setDeleteDiskSelected = jest.fn();

    // Act
    render(
      h(DeleteDiskChoices, {
        persistentDiskCostDisplay: pdCost,
        toolLabel: 'RStudio',
        cloudService: cloudServiceTypes.GCE,
        deleteDiskSelected,
        setDeleteDiskSelected,
      })
    );
    const radio1 = screen.getByLabelText('Keep persistent disk, delete application configuration and compute profile');
    const radio2 = screen.getByLabelText('Delete everything, including persistent disk');
    await userEvent.click(radio2);

    // Assert
    expect(radio1).toBeChecked();
    expect(radio2).not.toBeChecked();
    expect(setDeleteDiskSelected).toBeCalledTimes(1);
    expect(setDeleteDiskSelected).toBeCalledWith(true);
  });

  it('Should show SaveFilesHelp differently for RStudio', () => {
    // Arrange
    const pdCost = formatUSD(1.01);
    const deleteDiskSelected = false;
    const setDeleteDiskSelected = jest.fn();

    // Act
    render(
      h(DeleteDiskChoices, {
        persistentDiskCostDisplay: pdCost,
        toolLabel: 'RStudio',
        cloudService: cloudServiceTypes.GCE,
        deleteDiskSelected,
        setDeleteDiskSelected,
      })
    );

    // Assert
    expect(screen.getByText('move them to the workspace bucket.').closest('a')).toHaveAttribute(
      'aria-label',
      'RStudio save help'
    );
  });

  it('Should show SaveFilesHelp option for JupyterLab', () => {
    // Arrange
    const pdCost = formatUSD(1.01);
    const deleteDiskSelected = false;
    const setDeleteDiskSelected = jest.fn();

    // Act
    render(
      h(DeleteDiskChoices, {
        persistentDiskCostDisplay: pdCost,
        toolLabel: 'JupyterLab',
        cloudService: cloudServiceTypes.GCE,
        deleteDiskSelected,
        setDeleteDiskSelected,
      })
    );

    // Assert
    expect(screen.getByText('move them to the workspace bucket.').closest('a')).toHaveAttribute(
      'aria-label',
      'Save file help'
    );
  });

  it('Should show SaveFilesHelp option for Azure', () => {
    // Arrange
    const pdCost = formatUSD(1.01);
    const deleteDiskSelected = false;
    const setDeleteDiskSelected = jest.fn();

    // Act
    render(
      h(DeleteDiskChoices, {
        persistentDiskCostDisplay: pdCost,
        toolLabel: 'JupyterLab',
        cloudService: cloudServiceTypes.AZURE_VM,
        deleteDiskSelected,
        setDeleteDiskSelected,
      })
    );

    // Assert
    expect(screen.getByText('move them to the workspace bucket.').closest('a')).toHaveAttribute(
      'href',
      'https://support.terra.bio/hc/en-us/articles/12043575737883'
    );
  });
});

describe('DeleteEnvironment', () => {
  it.each([runtimeToolLabels.RStudio, runtimeToolLabels.Jupyter, runtimeToolLabels.JupyterLab])(
    'Should properly render when provided no disk/runtime with label %s',
    (toolLabel) => {
      // Arrange
      const setDeleteDiskSelected = jest.fn();
      const setViewMode = jest.fn();

      // Act
      render(
        h(DeleteEnvironment, {
          id: 'not-relevant',
          deleteDiskSelected: false,
          setDeleteDiskSelected,
          setViewMode,
          persistentDiskCostDisplay: formatUSD(1.01),
          renderActionButton,
          hideCloseButton: false,
          onDismiss: () => {},
          toolLabel,
        })
      );

      // Assert
      screen.getByText('Deleting your application configuration and cloud compute profile will also');
    }
  );
  it.each([
    { disk: getDisk(), toolLabel: runtimeToolLabels.RStudio },
    { disk: getDisk(), toolLabel: runtimeToolLabels.Jupyter },
    { disk: getAzureDisk(), toolLabel: runtimeToolLabels.JupyterLab },
  ])('Should properly render when provided no runtime but a disk', ({ disk, toolLabel }) => {
    // Arrange
    const setDeleteDiskSelected = jest.fn();
    const setViewMode = jest.fn();

    // Act
    render(
      h(DeleteEnvironment, {
        id: 'not-relevant',
        deleteDiskSelected: false,
        persistentDiskId: disk.id,
        persistentDiskCostDisplay: formatUSD(1.01),
        setDeleteDiskSelected,
        setViewMode,
        renderActionButton,
        hideCloseButton: false,
        onDismiss: () => {},
        toolLabel,
      })
    );

    // Assert
    screen.getByText(
      'If you want to permanently save some files from the disk before deleting it, you will need to create a new cloud environment to access it.'
    );
  });
  it('Should properly render when provided Azure config', () => {
    // Arrange
    const setDeleteDiskSelected = jest.fn();
    const setViewMode = jest.fn();
    const disk = getAzureDisk();
    const runtimeConfig = azureRuntime.runtimeConfig;

    // Act
    render(
      h(DeleteEnvironment, {
        id: 'not-relevant',
        runtimeConfig,
        persistentDiskId: disk.id,
        persistentDiskCostDisplay: formatUSD(1.01),
        deleteDiskSelected: false,
        setDeleteDiskSelected,
        setViewMode,
        renderActionButton,
        hideCloseButton: false,
        onDismiss: () => {},
        toolLabel: 'JupyterLab',
      })
    );

    // Assert
    screen.getByText('Delete application configuration and cloud compute profile');
    screen.getByText('Delete persistent disk');
  });
  it.each([runtimeToolLabels.RStudio, runtimeToolLabels.Jupyter])(
    'Should properly render when provided a GCEWithPD config with label %s',
    (toolLabel) => {
      // Arrange
      const setDeleteDiskSelected = jest.fn();
      const setViewMode = jest.fn();
      const disk = getDisk();
      const runtimeConfig = getRuntimeConfig({ persistentDiskId: disk.id });

      // Act
      render(
        h(DeleteEnvironment, {
          id: 'not-relevant',
          runtimeConfig,
          persistentDiskId: disk.id,
          persistentDiskCostDisplay: formatUSD(1.01),
          deleteDiskSelected: false,
          setDeleteDiskSelected,
          setViewMode,
          renderActionButton,
          hideCloseButton: false,
          onDismiss: () => {},
          toolLabel,
        })
      );

      // Assert
      screen.getByText('Keep persistent disk, delete application configuration and compute profile');
      screen.getByText(`/home/${toolLabel === 'RStudio' ? 'rstudio' : 'jupyter'}`);
      screen.getByText('Delete everything, including persistent disk');
    }
  );
  it('Should properly render when provided a GCE config', () => {
    // Arrange
    const setDeleteDiskSelected = jest.fn();
    const setViewMode = jest.fn();
    const disk = getDisk();
    const runtimeConfig = getRuntimeConfig();

    // Act
    render(
      h(DeleteEnvironment, {
        id: 'not-relevant',
        runtimeConfig,
        persistentDiskId: disk.id,
        persistentDiskCostDisplay: formatUSD(1.01),
        deleteDiskSelected: false,
        setDeleteDiskSelected,
        setViewMode,
        renderActionButton,
        hideCloseButton: false,
        onDismiss: () => {},
        toolLabel: 'RStudio',
      })
    );

    // Assert
    screen.getByText('Delete application configuration and cloud compute profile');
    screen.getByText('Delete persistent disk');
  });
  it.each([runtimeToolLabels.RStudio, runtimeToolLabels.Jupyter])(
    'Should properly render when provided GCE config that had matching PDID with label %s',
    (toolLabel) => {
      // Arrange
      const setDeleteDiskSelected = jest.fn();
      const setViewMode = jest.fn();
      const disk = getDisk();
      const runtimeConfig = getRuntimeConfig({ persistentDiskId: disk.id });
      if ('persistentDiskId' in runtimeConfig) runtimeConfig.persistentDiskId = disk.id;

      // Act
      render(
        h(DeleteEnvironment, {
          id: 'not-relevant',
          runtimeConfig,
          persistentDiskId: disk.id,
          persistentDiskCostDisplay: formatUSD(2.0),
          deleteDiskSelected: false,
          setDeleteDiskSelected,
          setViewMode,
          renderActionButton,
          hideCloseButton: false,
          onDismiss: () => {},
          toolLabel,
        })
      );

      // Assert

      screen.getByText('You will continue to incur persistent disk cost at');
      screen.getByText(`/home/${toolLabel === 'RStudio' ? 'rstudio' : 'jupyter'}`);
      screen.getByText('$2.00 per month.');
      screen.getByText('Also deletes your application configuration and cloud compute profile.');
    }
  );
  it('Should properly render when provided Azure config that had matching PDID', () => {
    // Arrange
    const setDeleteDiskSelected = jest.fn();
    const setViewMode = jest.fn();
    const disk = getAzureDisk();
    const runtimeConfig = azureRuntime.runtimeConfig;
    // this if statement is to satisfy typescript
    if ('persistentDiskId' in runtimeConfig) runtimeConfig.persistentDiskId = disk.id;

    // Act
    render(
      h(DeleteEnvironment, {
        id: 'not-relevant',
        runtimeConfig,
        persistentDiskId: disk.id,
        persistentDiskCostDisplay: formatUSD(3.01),
        deleteDiskSelected: false,
        setDeleteDiskSelected,
        setViewMode,
        renderActionButton,
        hideCloseButton: false,
        onDismiss: () => {},
        toolLabel: 'JupyterLab',
      })
    );

    // Assert

    screen.getByText('You will continue to incur persistent disk cost at');
    screen.getByText('/home/jupyter/persistent_disk');
    screen.getByText('$3.01 per month.');
    screen.getByText('Also deletes your application configuration and cloud compute profile.');
  });
});
