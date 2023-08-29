import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import {
  defaultGoogleWorkspace,
  defaultImage,
  defaultRImage,
  defaultTestDisk,
  getDisk,
  getGoogleDataProcRuntime,
  getGoogleRuntime,
  getJupyterRuntimeConfig,
  hailImage,
  testDefaultLocation,
} from 'src/analysis/_testData/testData';
import { GcpComputeImageSection } from 'src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeImageSection';
import { GcpComputeModalBase } from 'src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeModal';
import { getPersistentDiskCostMonthly, runtimeConfigBaseCost, runtimeConfigCost } from 'src/analysis/utils/cost-utils';
import { defaultDataprocMasterDiskSize, defaultDataprocWorkerDiskSize, defaultPersistentDiskType } from 'src/analysis/utils/disk-utils';
import { cloudServices } from 'src/analysis/utils/gce-machines';
import {
  defaultDataprocMachineType,
  defaultGceMachineType,
  defaultGpuType,
  defaultNumDataprocPreemptibleWorkers,
  defaultNumDataprocWorkers,
  defaultNumGpus,
} from 'src/analysis/utils/runtime-utils';
import { runtimeToolLabels, runtimeTools } from 'src/analysis/utils/tool-utils';
import { Ajax } from 'src/libs/ajax';
import { runtimeStatuses } from 'src/libs/ajax/leonardo/models/runtime-models';
import { formatUSD } from 'src/libs/utils';
import { asMockedFn } from 'src/testing/test-utils';

jest.mock('src/libs/notifications', () => ({
  notify: (...args) => {
    console.debug('######################### notify'); /* eslint-disable-line */
    console.debug({ method: 'notify', args: [...args] }); /* eslint-disable-line */
  },
}));

jest.mock('src/libs/ajax');
jest.mock('src/analysis/utils/cost-utils');
jest.mock('src/libs/config', () => ({
  getConfig: () => ({
    terraDeploymentEnv: 'unitTest',
    shouldUseDrsHub: true,
  }),
}));
jest.mock('src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeImageSection', () => {
  return {
    ...jest.requireActual('src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeImageSection'),
    __esModule: true,
    GcpComputeImageSection: jest.fn(),
  };
});

const onSuccess = jest.fn();
const defaultModalProps = {
  onSuccess,
  onDismiss: jest.fn(),
  onError: jest.fn(),
  currentRuntime: undefined,
  currentDisk: undefined,
  tool: runtimeToolLabels.Jupyter,
  workspace: defaultGoogleWorkspace,
  location: testDefaultLocation,
};

// TODO: test utils??
const verifyDisabled = (item) => expect(item).toHaveAttribute('disabled');
const verifyEnabled = (item) => expect(item).not.toHaveAttribute('disabled');

const defaultAjaxImpl = {
  Runtimes: {
    runtime: () => ({
      details: jest.fn(),
    }),
  },
  Disks: {
    disksV1: () => ({
      disk: () => ({
        details: jest.fn(),
      }),
    }),
  },
  Metrics: {
    captureEvent: () => jest.fn(),
  },
};

describe('GcpComputeModal', () => {
  beforeAll(() => {});

  beforeEach(() => {
    // Arrange
    GcpComputeImageSection.mockImplementation(() => {});
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getCreateButton = () => screen.getByText('Create');

  const selectRuntimeImage = (ImageSection, runtime, isCustom = false) => {
    const { onSelect: imageSectionOnSelect } = ImageSection.mock.lastCall[0];
    const { imageUrl } = _.find({ imageType: runtime.labels.tool }, runtime.runtimeImages);
    return imageSectionOnSelect({ url: imageUrl }, isCustom);
  };
  const selectImage = (ImageSection, { image, url, version, updated, packages, requiresSpark }, isCustom = false) => {
    const normalizedImage = { url: image ?? url, version, updated, packages, requiresSpark };
    const { onSelect: imageSectionOnSelect } = ImageSection.mock.lastCall[0];
    return imageSectionOnSelect(normalizedImage, isCustom);
  };

  it('renders correctly with minimal state', async () => {
    // Arrange

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });

    // Assert
    verifyEnabled(getCreateButton());
    screen.getByText('Jupyter Cloud Environment');
  });

  it('passes the TERRA_DEPLOYMENT_ENV and DRS_RESOLVER_ENDPOINT env vars through to the notebook through custom env vars', async () => {
    // Arrange
    const user = userEvent.setup();

    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
    }));

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });

    await user.click(getCreateButton());

    // Assert
    expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        customEnvironmentVariables: expect.objectContaining({
          TERRA_DEPLOYMENT_ENV: 'unitTest',
          DRS_RESOLVER_ENDPOINT: 'api/v4/drs/resolve',
        }),
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('sends the proper leo API call in default create case (no runtimes or disks)', async () => {
    // Arrange
    const user = userEvent.setup();

    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
    }));

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });
    await act(async () => {
      selectImage(GcpComputeImageSection, defaultImage);
    });
    await user.click(getCreateButton());

    // Assert
    const labels = {
      saturnWorkspaceNamespace: defaultModalProps.workspace.workspace.namespace,
      saturnWorkspaceName: defaultModalProps.workspace.workspace.name,
    };
    expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        labels,
        runtimeConfig: expect.objectContaining({
          cloudService: cloudServices.GCE,
          machineType: defaultGceMachineType,
          persistentDisk: expect.objectContaining({
            diskType: defaultPersistentDiskType.value,
            labels,
            name: expect.anything(),
          }),
        }),
        toolDockerImage: defaultImage.image,
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  // create button with disk but no runtime
  it('sends the proper API call in create case with an existing disk but no runtime', async () => {
    // Arrange
    const user = userEvent.setup();

    // put value into local var so its easier to refactor
    const disk = defaultTestDisk;
    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
      Disks: {
        disksV1: () => ({
          disk: () => ({
            details: () => disk,
          }),
        }),
      },
    }));

    // Act
    await act(async () => {
      render(
        h(GcpComputeModalBase, {
          ...defaultModalProps,
          currentDisk: disk,
        })
      );
    });

    await user.click(getCreateButton());

    // Assert
    expect(runtimeFunc).toHaveBeenCalledWith(defaultGoogleWorkspace.workspace.googleProject, expect.anything());
    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeConfig: expect.objectContaining({
          persistentDisk: { name: disk.name },
        }),
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  // with a [jupyter, rstudio] runtime existing and, details pane is open
  it.each([{ runtimeTool: runtimeTools.Jupyter }, { runtimeTool: runtimeTools.RStudio }])(
    'opens runtime details pane with a $runtimeTool.label runtime and a disk existing',
    async ({ runtimeTool }) => {
      // Arrange
      const disk = getDisk();
      const machine = { name: 'n1-standard-4', cpu: 4, memory: 15 };
      const runtimeProps = { tool: runtimeTool, runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, machineType: machine.name }) };
      const runtime = getGoogleRuntime(runtimeProps);

      const runtimeFunc = jest.fn(() => ({
        create: jest.fn(),
        details: () => runtime,
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
        Disks: {
          disksV1: () => ({
            disk: () => ({
              details: () => disk,
            }),
          }),
        },
      }));

      // Act
      await act(async () => {
        render(
          h(GcpComputeModalBase, {
            ...defaultModalProps,
            currentDisk: disk,
            currentRuntime: runtime,
            tool: runtimeTool.label,
          })
        );
      });

      // Act
      await act(async () => {
        selectRuntimeImage(GcpComputeImageSection, runtime);
      });

      // Assert
      screen.getByText(`${runtimeTool.label} Cloud Environment`);

      screen.getByText(machine.cpu);
      screen.getByText(machine.memory);

      verifyDisabled(screen.getByLabelText('Disk Type'));
      verifyDisabled(screen.getByLabelText('Location'));
      screen.getByDisplayValue(disk.size);

      verifyEnabled(screen.getByText('Delete Environment'));
      verifyEnabled(screen.getByText('Update'));
    }
  );

  it.each([{ status: runtimeStatuses.running }, { status: runtimeStatuses.starting }])(
    'lets the user update a runtime only in an appropriate status ($status.label, $status.canChangeCompute)',
    async ({ status }) => {
      // Arrange
      const disk = getDisk();
      const runtimeProps = { status: status.leoLabel, runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id }) };
      const runtime = getGoogleRuntime(runtimeProps);

      const runtimeFunc = jest.fn(() => ({
        details: () => runtime,
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
        Disks: {
          disksV1: () => ({
            disk: () => ({
              details: () => disk,
            }),
          }),
        },
      }));

      // Act
      await act(async () => {
        render(
          h(GcpComputeModalBase, {
            ...defaultModalProps,
            currentDisk: disk,
            currentRuntime: runtime,
          })
        );
      });
      await act(async () => {
        selectRuntimeImage(GcpComputeImageSection, runtime);
      });

      // Assert
      if (status.canChangeCompute) {
        verifyEnabled(screen.getByText('Update'));
      } else {
        verifyDisabled(screen.getByText('Update'));
      }
    }
  );

  // click delete environment on an existing [jupyter, rstudio] runtime with disk should bring up confirmation
  it.each([{ tool: runtimeTools.Jupyter }, { tool: runtimeTools.RStudio }])(
    'deletes environment with a confirmation for disk deletion for tool $tool.label',
    async ({ tool }) => {
      // Arrange
      const user = userEvent.setup();

      const disk = getDisk();
      const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) };
      const runtime = getGoogleRuntime(runtimeProps);

      const runtimeFunc = jest.fn(() => ({
        details: () => runtime,
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
        Disks: {
          disksV1: () => ({
            disk: () => ({
              details: () => disk,
            }),
          }),
        },
      }));

      // Act
      await act(async () => {
        render(
          h(GcpComputeModalBase, {
            ...defaultModalProps,
            currentDisk: disk,
            currentRuntime: runtime,
          })
        );
      });

      await user.click(screen.getByText('Delete Environment'));

      // Assert
      verifyEnabled(screen.getByText('Delete'));
      const radio1 = screen.getByLabelText('Keep persistent disk, delete application configuration and compute profile');
      expect(radio1).toBeChecked();
      const radio2 = screen.getByLabelText('Delete everything, including persistent disk');
      expect(radio2).not.toBeChecked();
    }
  );

  // click delete environment on an existing [jupyter, rstudio] runtime with disk should delete
  it.each([{ tool: runtimeTools.Jupyter }, { tool: runtimeTools.RStudio }])(
    'clicking through delete confirmation and then delete should call delete for tool $tool.label',
    async ({ tool }) => {
      // Arrange
      const user = userEvent.setup();

      const disk = getDisk();
      const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) };
      const runtime = getGoogleRuntime(runtimeProps);

      const deleteFunc = jest.fn();

      const runtimeFunc = jest.fn(() => ({
        details: () => runtime,
        delete: deleteFunc,
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
        Disks: {
          disksV1: () => ({
            disk: () => ({
              details: () => disk,
            }),
          }),
        },
      }));

      // Act
      await act(async () => {
        render(
          h(GcpComputeModalBase, {
            ...defaultModalProps,
            currentDisk: disk,
            currentRuntime: runtime,
          })
        );
      });

      await user.click(screen.getByText('Delete Environment'));
      await user.click(screen.getByText('Delete'));

      // Assert
      expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
      expect(deleteFunc).toHaveBeenCalled();
    }
  );
  // click update with downtime (and keep pd)
  it.each([{ tool: runtimeTools.Jupyter }, { tool: runtimeTools.RStudio }])(
    'updating a runtime after changing a field that requires downtime should call update for tool $tool.label',
    async ({ tool }) => {
      // Arrange
      const user = userEvent.setup();

      const disk = getDisk();
      const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) };
      const runtime = getGoogleRuntime(runtimeProps);

      const updateFunc = jest.fn();

      const runtimeFunc = jest.fn(() => ({
        details: () => runtime,
        update: updateFunc,
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
        Disks: {
          disksV1: () => ({
            disk: () => ({
              details: () => disk,
            }),
          }),
        },
      }));

      // Act
      await act(async () => {
        render(
          h(GcpComputeModalBase, {
            ...defaultModalProps,
            currentDisk: disk,
            currentRuntime: runtime,
          })
        );
      });
      await act(async () => {
        selectRuntimeImage(GcpComputeImageSection, runtime);
      });

      await user.click(screen.getByLabelText('CPUs'));
      const selectOption = await screen.findByText('2');
      await user.click(selectOption);
      const nextButton = await screen.findByText('Next');
      await user.click(nextButton);

      // Assert
      await screen.findByText('Downtime required');

      // Act
      const updateButton = await screen.findByText('Update');
      await user.click(updateButton);

      // Assert
      expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
      expect(updateFunc).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeConfig: {
            cloudService: 'GCE',
            machineType: 'n1-standard-2',
            zone: 'us-central1-a',
          },
        })
      );
    }
  );

  // TODO: this is a bug that this doesn't work... needs more investigation
  // click update with no downtime (and keep pd)
  // it.each([
  //   { tool: tools.Jupyter },
  //   { tool: tools.RStudio }
  // ])
  // ('Updating a runtime and changing a field that requires no downtime should call update for tool $tool.label', async ({ tool }) => {
  //   const disk = getDisk()
  //   const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) }
  //   const runtime = getGoogleRuntime(runtimeProps)
  //
  //   const updateFunc = jest.fn()
  //
  //   const runtimeFunc = jest.fn(() => ({
  //     details: () => runtime,
  //     update: updateFunc
  //   }))
  //   Ajax.mockImplementation(() => ({
  //     ...defaultAjaxImpl,
  //     Runtimes: {
  //       runtime: runtimeFunc,
  //     },
  //     Disks: {
  //       disk: () => ({
  //         details: () => disk
  //       })
  //     }
  //   }))
  //
  //   // Act
  //   await act(async () => {
  //     await render(h(GcpComputeModalBase, {
  //       ...defaultModalProps,
  //       currentDisk: disk,
  //       currentRuntime: runtime
  //     }))
  //
  //     const numberInput = await screen.getByDisplayValue(disk.size)
  //     expect(numberInput).toBeInTheDocument()
  //     fireEvent.change(numberInput, { target: { value: 51 } })
  //
  //     const changedNumberInput = await screen.getByDisplayValue(51)
  //     expect(changedNumberInput).toBeInTheDocument()
  //
  //     const updateButton = await screen.findByText('Update')
  //     await userEvent.click(updateButton)
  //   })
  //
  //   expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything())
  //   // expect(screen.getByText('51')).toBeInTheDocument()
  //   expect(updateFunc).toHaveBeenCalledWith(expect.objectContaining({
  //     runtimeConfig: expect.objectContaining({
  //       diskSize: 51
  //     })
  //   }))
  // })

  // TODO: this is a bug that this doesn't work... needs more investigation
  // decrease disk size
  // it.each([
  //   { tool: tools.Jupyter },
  //   { tool: tools.RStudio }
  // ])
  // ('Decreasing disk size should prompt user their disk will be deleted for $tool.label', async ({ tool }) => {
  //   const disk = getDisk()
  //   const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) }
  //   const runtime = getGoogleRuntime(runtimeProps)
  //
  //   const createFunc = jest.fn()
  //   const deleteFunc = jest.fn()
  //
  //   const runtimeFunc = jest.fn(() => ({
  //     details: () => runtime,
  //     create: createFunc,
  //     delete: deleteFunc
  //   }))
  //   Ajax.mockImplementation(() => ({
  //     ...defaultAjaxImpl,
  //     Runtimes: {
  //       runtime: runtimeFunc,
  //     },
  //     Disks: {
  //       disk: () => ({
  //         details: () => disk
  //       })
  //     }
  //   }))
  //
  //   // Act
  //   await act(async () => {
  //     await render(h(GcpComputeModalBase, {
  //       ...defaultModalProps,
  //       currentDisk: disk,
  //       currentRuntime: runtime
  //     }))
  //
  //     const numberInput = await screen.getByDisplayValue(disk.size)
  //     expect(numberInput).toBeInTheDocument()
  //     fireEvent.change(numberInput, { target: { value: disk.size - 1 } })
  //
  //     const changedNumberInput = await screen.getByDisplayValue(disk.size - 1)
  //     expect(changedNumberInput).toBeInTheDocument()
  //
  //     const nextButton = await screen.findByText('Update')
  //     await userEvent.click(nextButton)
  //
  //     const deleteConfirmationPaneHeader = await screen.findByText('Data will be deleted')
  //     expect(deleteConfirmationPaneHeader).toBeInTheDocument()
  //
  //     const updateButton = await screen.findByText('Update')
  //     await userEvent.click(updateButton)
  //   })
  //
  //   expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, runtime.runtimeName)
  //   expect(deleteFunc).toHaveBeenCalled()
  //   expect(createFunc).toHaveBeenCalledWith(expect.objectContaining({
  //     runtimeConfig: expect.objectContaining({
  //       persistentDisk: expect.objectContaining({
  //         size: disk.size - 1
  //       })
  //     })
  //   }))
  // })

  it('should create dataproc spark cluster successfully', async () => {
    // Arrange
    const user = userEvent.setup();

    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
      Disks: {
        disk: () => ({
          details: jest.fn(),
        }),
      },
    }));

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });
    await act(async () => {
      selectImage(GcpComputeImageSection, hailImage);
    });
    await act(async () => {
      const computeTypeSelect = screen.getByLabelText('Compute type');
      await user.click(computeTypeSelect);
    });
    await act(async () => {
      const sparkClusterOption = await screen.findByText('Spark cluster');
      await user.click(sparkClusterOption);
    });
    await act(async () => {
      const create = screen.getByText('Create');
      await user.click(create);
    });
    expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        toolDockerImage: hailImage.image,
        runtimeConfig: expect.objectContaining({
          numberOfWorkers: defaultNumDataprocWorkers,
          masterMachineType: defaultDataprocMachineType,
          masterDiskSize: defaultDataprocMasterDiskSize,
          workerMachineType: defaultDataprocMachineType,
          workerDiskSize: defaultDataprocWorkerDiskSize,
          numberOfPreemptibleWorkers: defaultNumDataprocPreemptibleWorkers,
          cloudService: 'DATAPROC',
          region: 'us-central1',
          componentGatewayEnabled: true,
        }),
      })
    );
  });

  it('should create dataproc spark single node successfully', async () => {
    // Arrange
    const createFunc = jest.fn();
    const user = userEvent.setup();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
      Disks: {
        disk: () => ({
          details: jest.fn(),
        }),
      },
    }));

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });

    const selectMenu = screen.getByLabelText('Application configuration');
    await user.click(selectMenu);
    const selectOption = await screen.findByText(hailImage.label);
    await user.click(selectOption);
    const create = screen.getByText('Create');
    await user.click(create);

    expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());

    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        toolDockerImage: hailImage.image,
        runtimeConfig: expect.objectContaining({
          numberOfWorkers: 0,
          masterMachineType: defaultDataprocMachineType,
          masterDiskSize: defaultDataprocMasterDiskSize,
          cloudService: 'DATAPROC',
          region: 'us-central1',
          componentGatewayEnabled: true,
        }),
      })
    );
  });

  // TODO: This causes a warning, but because of the underlying components implementation
  // Strongly recommend typing the compute modal before attempting to fix
  it('should delete spark single node successfully', async () => {
    // Arrange
    const user = userEvent.setup();

    const runtimeProps = {
      runtimeConfig: getJupyterRuntimeConfig({
        diskId: undefined,
        tool: runtimeTools.Jupyter,
      }),
    };
    const runtime = getGoogleDataProcRuntime(runtimeProps);

    const deleteFunc = jest.fn();

    const runtimeFunc = jest.fn(() => ({
      details: () => runtime,
      delete: deleteFunc,
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
      Disks: {
        disksV1: () => ({
          disk: () => ({
            details: () => undefined,
          }),
        }),
      },
    }));

    // Act
    await act(async () => {
      render(
        h(GcpComputeModalBase, {
          ...defaultModalProps,
          currentDisk: undefined,
          currentRuntime: runtime,
        })
      );
    });

    await user.click(screen.getByText('Delete Runtime'));
    await user.click(screen.getByText('Delete'));

    // Assert
    expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
    expect(deleteFunc).toHaveBeenCalled();
  });

  // with a [jupyter, rstudio] runtime existing and [a disk, no disk], details pane is open
  it('dataproc runtime should display properly in modal', async () => {
    // Arrange
    const machine1 = { name: 'n1-standard-2', cpu: 2, memory: 7.5 };
    const machine2 = { name: 'n1-standard-4', cpu: 4, memory: 15 };
    const runtimeProps = {
      image: hailImage.image,
      status: runtimeStatuses.stopped.leoLabel,
      runtimeConfig: {
        numberOfWorkers: 2,
        masterMachineType: machine1.name,
        masterDiskSize: 151,
        workerMachineType: machine2.name,
        workerDiskSize: 150,
        numberOfWorkerLocalSSDs: 0,
        numberOfPreemptibleWorkers: 0,
        cloudService: 'DATAPROC',
        region: 'us-central1',
        componentGatewayEnabled: true,
        workerPrivateAccess: false,
      },
    };
    const runtime = getGoogleRuntime(runtimeProps);

    const runtimeFunc = jest.fn(() => ({
      create: jest.fn(),
      details: () => runtime,
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
      Disks: {
        disk: () => ({
          details: jest.fn(),
        }),
      },
    }));

    // Act
    await act(async () => {
      render(
        h(GcpComputeModalBase, {
          ...defaultModalProps,
          currentRuntime: runtime,
        })
      );
    });

    // Assert
    screen.getByText(`${runtimeToolLabels.Jupyter} Cloud Environment`);

    const selectText = hailImage.label;
    screen.getByText(selectText);

    screen.getByText(machine1.cpu);
    screen.getByText(machine1.memory);
    screen.getByText('Spark cluster');

    verifyDisabled(screen.getByLabelText('Workers'));
    verifyDisabled(screen.getByLabelText('Location'));

    const inputs = screen.getAllByLabelText('Disk size (GB)');
    expect(inputs.length).toBe(2);
    expect(inputs[1]).toHaveDisplayValue(150);
    expect(inputs[0]).toHaveDisplayValue(151);

    screen.getByText(machine2.cpu);
    screen.getByText(machine2.memory);

    verifyEnabled(screen.getByText('Delete Runtime'));
    screen.getByText('Update');
  });

  // spark cluster (pass a dataproc runtime and ensure it loads correctly) (
  it('creates a dataproc runtime', async () => {
    // Arrange
    const user = userEvent.setup();

    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
      Disks: {
        disk: () => ({
          details: jest.fn(),
        }),
      },
    }));

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });

    const selectMenu = screen.getByLabelText('Application configuration');
    await user.click(selectMenu);
    const selectOption = await screen.findByText(hailImage.label);
    await user.click(selectOption);
    const computeTypeSelect = screen.getByLabelText('Compute type');
    await user.click(computeTypeSelect);
    const sparkClusterOption = await screen.findByText('Spark cluster');
    await user.click(sparkClusterOption);

    const create = screen.getByText('Create');
    await user.click(create);

    expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        toolDockerImage: hailImage.image,
        runtimeConfig: expect.objectContaining({
          numberOfWorkers: defaultNumDataprocWorkers,
          masterMachineType: defaultDataprocMachineType,
          masterDiskSize: defaultDataprocMasterDiskSize,
          workerMachineType: defaultDataprocMachineType,
          workerDiskSize: defaultDataprocWorkerDiskSize,
          numberOfPreemptibleWorkers: defaultNumDataprocPreemptibleWorkers,
          cloudService: 'DATAPROC',
          region: 'us-central1',
          componentGatewayEnabled: true,
        }),
      })
    );
  });

  // custom on image select with a [valid, invalid] custom image should function
  it.each([{ tool: runtimeTools.Jupyter }, { tool: runtimeTools.RStudio }])(
    'custom Environment pane should behave correctly with an invalid image URI',
    async ({ tool }) => {
      // Arrange
      const user = userEvent.setup();

      const createFunc = jest.fn();
      const disk = getDisk();
      const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) };
      const runtime = getGoogleRuntime(runtimeProps);

      const runtimeFunc = jest.fn(() => ({
        details: () => runtime,
        create: createFunc,
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
        Disks: {
          disk: () => ({
            details: () => disk,
          }),
        },
      }));

      // Act and assert
      await act(async () => {
        render(h(GcpComputeModalBase, defaultModalProps));
      });

      const selectMenu = screen.getByLabelText('Application configuration');
      await user.click(selectMenu);
      const selectOption = await screen.findByText('Custom Environment');
      await user.click(selectOption);

      const imageInput = screen.getByLabelText('Container image');
      expect(imageInput).toBeInTheDocument();
      const invalidImageUri = 'b';
      await user.type(imageInput, invalidImageUri);

      const nextButton = await screen.findByText('Next');

      verifyDisabled(nextButton);
    }
  );

  // custom on image select with a [valid, invalid] custom image should function
  it.each([{ tool: runtimeTools.Jupyter }, { tool: runtimeTools.RStudio }])(
    'custom Environment pane should work with a valid image URI ',
    async ({ tool }) => {
      // Arrange
      const user = userEvent.setup();

      const createFunc = jest.fn();
      const disk = getDisk();
      const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) };
      const runtime = getGoogleRuntime(runtimeProps);

      const runtimeFunc = jest.fn(() => ({
        details: () => runtime,
        create: createFunc,
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
        Disks: {
          disk: () => ({
            details: () => disk,
          }),
        },
      }));

      // Act and assert
      await act(async () => {
        render(h(GcpComputeModalBase, defaultModalProps));
      });

      const selectMenu = screen.getByLabelText('Application configuration');
      await user.click(selectMenu);
      const selectOption = await screen.findByText('Custom Environment');
      await user.click(selectOption);

      const imageInput = screen.getByLabelText('Container image');
      expect(imageInput).toBeInTheDocument();
      const customImageUri = 'us';
      await user.type(imageInput, customImageUri);

      await screen.findByText('Creation Timeout Limit');

      const nextButton = await screen.findByText('Next');
      verifyEnabled(nextButton);
      await user.click(nextButton);
      const unverifiedDockerWarningHeader = await screen.findByText('Unverified Docker image');

      expect(unverifiedDockerWarningHeader).toBeInTheDocument();
      const createButton = await screen.findByText('Create');
      await user.click(createButton);
      expect(runtimeFunc).toHaveBeenCalledWith(defaultModalProps.workspace.workspace.googleProject, expect.anything());
      expect(createFunc).toHaveBeenCalledWith(
        expect.objectContaining({
          toolDockerImage: customImageUri,
        })
      );
    }
  );

  // click learn more about persistent disk
  it('should render learn more about persistent disks', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(h(GcpComputeModalBase, defaultModalProps));
    const link = screen.getByText('Learn more about persistent disks and where your disk is mounted.');
    await user.click(link);

    // Assert
    screen.getByText('About persistent disk');
    screen.getByText(/Your persistent disk is mounted in the directory/);
  });

  it.each([{ tool: runtimeTools.Jupyter }, { tool: runtimeTools.RStudio }])(
    'should check successfully that the disk type is clickable',
    async ({ tool }) => {
      // arrange
      const user = userEvent.setup();

      const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ tool }) };
      const runtime = getGoogleRuntime(runtimeProps);

      // Act
      await act(async () => {
        render(
          h(GcpComputeModalBase, {
            ...defaultModalProps,
            currentRuntime: runtime,
          })
        );
      });

      // Assert
      const diskTypeDropdown = screen.getByLabelText('Disk Type');
      await user.click(diskTypeDropdown);
    }
  );

  it('should render whats installed on this environment', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });

    const link = await screen.getByText('What’s installed on this environment?');
    await user.click(link);

    // Assert
    screen.getByText('Installed packages');
    screen.getByText(defaultImage.label);
    screen.getByText('Language:');
  });

  // GPUs should function properly
  it.each([{ tool: runtimeTools.Jupyter.label }, { tool: runtimeTools.RStudio.label }])('creates a runtime with GPUs for $tool', async ({ tool }) => {
    // Arrange
    const user = userEvent.setup();

    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
    }));
    // Act
    await act(async () => {
      render(
        h(GcpComputeModalBase, {
          ...defaultModalProps,
          tool,
        })
      );
    });

    const enableGPU = await screen.getByText('Enable GPUs');
    await user.click(enableGPU);

    // Assert
    screen.getByText('GPU type');
    screen.getByText('GPUs');

    // Act
    const create = screen.getByText('Create');
    await user.click(create);

    // Assert
    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeConfig: expect.objectContaining({
          gpuConfig: { gpuType: defaultGpuType, numOfGpus: defaultNumGpus },
        }),
      })
    );
  });

  // click learn more about persistent disk
  it.each([
    { tool: runtimeTools.Jupyter.label, expectedLabel: '/home/jupyter' },
    { tool: runtimeTools.RStudio.label, expectedLabel: '/home/rstudio' },
  ])('should render learn more about persistent disks', async ({ tool, expectedLabel }) => {
    // Arrange
    const user = userEvent.setup();

    const disk = getDisk();
    const runtimeProps = { runtimeConfig: getJupyterRuntimeConfig({ diskId: disk.id, tool }) };
    const runtime = getGoogleRuntime(runtimeProps);
    // Act
    // HACK: await not necessary here
    // eslint-disable-next-line require-await
    await act(async () => {
      render(
        h(GcpComputeModalBase, {
          ...defaultModalProps,
          currentDisk: disk,
          currentRuntime: runtime,
          tool,
        })
      );
    });

    // Assert
    const link = screen.getByText('Learn more about persistent disks and where your disk is mounted.');
    await user.click(link);
    screen.getByText('About persistent disk');
    screen.getByText(expectedLabel);
  });

  it('correctly renders and updates timeoutInMinutes', async () => {
    // Arrange
    const user = userEvent.setup();

    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
    }));
    render(h(GcpComputeModalBase, defaultModalProps));

    // Act
    const selectMenu = screen.getByLabelText('Application configuration');
    await user.click(selectMenu);
    const selectOption = await screen.findByText(/Legacy GATK:/);
    await user.click(selectOption);

    await screen.findByText('Creation Timeout Limit');
    const timeoutInput = screen.getByLabelText('Creation Timeout Limit');
    await user.type(timeoutInput, '20');

    // Assert
    expect(timeoutInput.value).toBe('20');

    // Act
    await user.click(selectMenu);
    const selectOption2 = await screen.findByText(defaultImage.label);
    await user.click(selectOption2);
    // Assert
    expect(timeoutInput).not.toBeVisible();
  });

  it.each([{ runtimeTool: runtimeTools.Jupyter }, { runtimeTool: runtimeTools.RStudio }])(
    'correctly sends timeoutInMinutes to create for tool $runtimeTool.label',
    async ({ runtimeTool }) => {
      // Arrange
      const user = userEvent.setup();
      const createFunc = jest.fn();
      const runtimeFunc = jest.fn(() => ({
        create: createFunc,
        details: jest.fn(),
      }));
      Ajax.mockImplementation(() => ({
        ...defaultAjaxImpl,
        Runtimes: {
          runtime: runtimeFunc,
        },
      }));

      // Act
      await act(async () => {
        render(h(GcpComputeModalBase, { ...defaultModalProps, tool: runtimeTool.label }));
      });

      const selectMenu = screen.getByLabelText('Application configuration');
      await user.click(selectMenu);
      const customImageSelect = await screen.findByText('Custom Environment');
      await user.click(customImageSelect);

      await screen.findByText('Creation Timeout Limit');
      const timeoutInput = screen.getByLabelText('Creation Timeout Limit');

      const imageInput = screen.getByLabelText('Container image');
      expect(imageInput).toBeInTheDocument();
      const customImageUri = 'us';
      await user.type(imageInput, customImageUri);

      await user.type(timeoutInput, '20');
      await user.click(selectMenu);

      const nextButton = await screen.findByText('Next');
      verifyEnabled(nextButton);
      await user.click(nextButton);
      const unverifiedDockerWarningHeader = await screen.findByText('Unverified Docker image');

      expect(unverifiedDockerWarningHeader).toBeInTheDocument();
      const createButton = await screen.findByText('Create');
      await user.click(createButton);

      // Assert
      expect(createFunc).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutInMinutes: 20,
        })
      );
    }
  );

  it.each([
    { runtimeTool: runtimeTools.Jupyter, imageLabel: defaultImage.label },
    { runtimeTool: runtimeTools.RStudio, imageLabel: defaultRImage.label },
  ])('sends null timeout in minutes  for tool $runtimeTool.label after setting and clearing the field', async ({ runtimeTool, imageLabel }) => {
    // Arrange
    const user = userEvent.setup();

    const createFunc = jest.fn();
    const runtimeFunc = jest.fn(() => ({
      create: createFunc,
      details: jest.fn(),
    }));
    Ajax.mockImplementation(() => ({
      ...defaultAjaxImpl,
      Runtimes: {
        runtime: runtimeFunc,
      },
    }));

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, { ...defaultModalProps, tool: runtimeTool.label }));
    });

    const selectMenu = screen.getByLabelText('Application configuration');
    await user.click(selectMenu);
    const customImageSelect = await screen.findByText('Custom Environment');
    await user.click(customImageSelect);

    await screen.findByText('Creation Timeout Limit');
    const timeoutInput = screen.getByLabelText('Creation Timeout Limit');
    // Set the field to an arbitrary value
    await user.type(timeoutInput, '20');
    await user.click(selectMenu);
    const supportedImageSelect = await screen.findByText(imageLabel);
    // Clear timeoutInput by selecting
    await user.click(supportedImageSelect);

    // Act
    const create = screen.getByText('Create');
    await user.click(create);

    // Assert
    expect(createFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        // Verify that timeoutInMinutes is actually cleared by selecting
        // a supported image.
        timeoutInMinutes: null,
      })
    );
  });

  it('renders default cost estimate', async () => {
    // Arrange
    const expectedRuntimeConfigCost = 0.4;
    const expectedRuntimeConfigBaseCost = 0.15;
    const expectedPersistentDiskCostMonthly = 0.2;

    asMockedFn(runtimeConfigCost).mockReturnValue(expectedRuntimeConfigCost);
    asMockedFn(runtimeConfigBaseCost).mockReturnValue(expectedRuntimeConfigBaseCost);
    asMockedFn(getPersistentDiskCostMonthly).mockReturnValue(expectedPersistentDiskCostMonthly);

    // Act
    await act(async () => {
      render(h(GcpComputeModalBase, defaultModalProps));
    });

    // Assert
    expect(screen.getByText(formatUSD(expectedRuntimeConfigCost)));
    expect(screen.getByText(formatUSD(expectedRuntimeConfigBaseCost)));
    expect(screen.getByText(formatUSD(expectedPersistentDiskCostMonthly)));
  });
});
