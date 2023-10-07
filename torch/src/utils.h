#pragma once

#include <napi.h>
#include <torch/torch.h>
namespace nodeml_torch
{
    template <typename T>
    std::vector<T> NapiArrayToVector(Napi::Array &arr);

    template <typename T>
    std::vector<T> VectorToNapiArray(const Napi::CallbackInfo &info);
}
